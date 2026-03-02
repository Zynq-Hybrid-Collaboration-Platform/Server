import { EventEmitter } from "events";
import { TasksRepository } from "./tasks.repository";
import {
  ICreateTaskDTO,
  IUpdateTaskDTO,
  IMoveTaskDTO,
  ITaskSafe,
  ITaskLean,
  IPaginatedTasks,
  TaskEvent,
  TaskStatus,
  TaskPriority,
} from "./tasks.types";
import { NotFoundError } from "../../core/errors";
import { logger } from "../../core/logger/logger";

/** Rebalance gap — matches repository */
const POSITION_GAP = 65536;

/** Minimum distance between positions before rebalancing */
const MIN_POSITION_GAP = 0.001;

/**
 * Tasks Service — business logic + domain events.
 *
 * Uses fractional indexing for drag-and-drop reordering:
 *   - New tasks are placed at the end of their column (maxPosition + POSITION_GAP)
 *   - Moving between tasks: position = (posAbove + posBelow) / 2
 *   - When gap gets too small (< MIN_POSITION_GAP), rebalance the entire column
 */
export class TasksService {
  private repository: TasksRepository;
  readonly events: EventEmitter;

  constructor(repository: TasksRepository) {
    this.repository = repository;
    this.events = new EventEmitter();
  }

  // ─────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────

  async getTask(orgId: string, taskId: string): Promise<ITaskSafe> {
    const task = await this.repository.findById(orgId, taskId);
    if (!task) {
      throw new NotFoundError("Task");
    }
    return this.sanitize(task);
  }

  async getBoardTasks(
    orgId: string,
    boardId: string,
    status?: TaskStatus,
    cursor?: string,
    limit?: number
  ): Promise<IPaginatedTasks> {
    const { tasks, hasMore } = await this.repository.findByBoard(
      orgId,
      boardId,
      status,
      cursor,
      limit
    );

    const safeTasks = tasks.map((t) => this.sanitize(t));
    const nextCursor =
      safeTasks.length > 0
        ? String(safeTasks[safeTasks.length - 1].position)
        : null;

    return { tasks: safeTasks, nextCursor, hasMore };
  }

  // ─────────────────────────────────────────────────────
  // Commands
  // ─────────────────────────────────────────────────────

  async createTask(
    orgId: string,
    reporterId: string,
    dto: ICreateTaskDTO
  ): Promise<ITaskSafe> {
    const status = dto.status ?? TaskStatus.BACKLOG;

    // Place at end of column
    const maxPos = await this.repository.getMaxPosition(
      orgId,
      dto.boardId,
      status
    );
    const position = maxPos + POSITION_GAP;

    const task = await this.repository.create({
      orgId,
      boardId: dto.boardId,
      title: dto.title,
      description: dto.description ?? "",
      status,
      priority: dto.priority ?? TaskPriority.NONE,
      position,
      assigneeIds: dto.assigneeIds ?? [],
      reporterId,
      labels: dto.labels ?? [],
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    const safe = this.sanitize(task);

    this.events.emit(TaskEvent.CREATED, { orgId, task: safe });
    logger.debug("Task created", { taskId: safe.id, boardId: dto.boardId });

    return safe;
  }

  async updateTask(
    orgId: string,
    taskId: string,
    dto: IUpdateTaskDTO
  ): Promise<ITaskSafe> {
    const updated = await this.repository.update(orgId, taskId, {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      assigneeIds: dto.assigneeIds,
      labels: dto.labels,
      dueDate: dto.dueDate === null ? null : dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    if (!updated) {
      throw new NotFoundError("Task");
    }

    const safe = this.sanitize(updated);

    this.events.emit(TaskEvent.UPDATED, { orgId, task: safe });

    return safe;
  }

  /**
   * Move a task to a new column/position.
   *
   * Fractional indexing logic:
   * - Client sends the desired status and position
   * - If the gap between adjacent tasks is too small, trigger rebalance
   */
  async moveTask(
    orgId: string,
    taskId: string,
    dto: IMoveTaskDTO
  ): Promise<ITaskSafe> {
    const existing = await this.repository.findById(orgId, taskId);
    if (!existing) {
      throw new NotFoundError("Task");
    }

    const moved = await this.repository.moveTask(
      orgId,
      taskId,
      dto.status,
      dto.position
    );

    if (!moved) {
      throw new NotFoundError("Task");
    }

    // Check if rebalance is needed
    const columnTasks = await this.repository.findByColumn(
      orgId,
      existing.boardId.toString(),
      dto.status
    );

    if (this.needsRebalance(columnTasks)) {
      await this.repository.rebalanceColumn(
        orgId,
        existing.boardId.toString(),
        dto.status
      );
      logger.debug("Column rebalanced", {
        boardId: existing.boardId.toString(),
        status: dto.status,
      });
    }

    const safe = this.sanitize(moved);

    this.events.emit(TaskEvent.MOVED, {
      orgId,
      taskId,
      fromStatus: existing.status,
      toStatus: dto.status,
      task: safe,
    });

    return safe;
  }

  async deleteTask(orgId: string, taskId: string): Promise<void> {
    const existing = await this.repository.findById(orgId, taskId);
    if (!existing) {
      throw new NotFoundError("Task");
    }

    const deleted = await this.repository.delete(orgId, taskId);
    if (!deleted) {
      throw new NotFoundError("Task");
    }

    this.events.emit(TaskEvent.DELETED, {
      orgId,
      taskId,
      boardId: existing.boardId.toString(),
    });

    logger.debug("Task deleted", { taskId });
  }

  // ─────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────

  /**
   * Check if any adjacent tasks are too close in position.
   */
  private needsRebalance(tasks: ITaskLean[]): boolean {
    for (let i = 1; i < tasks.length; i++) {
      const gap = tasks[i].position - tasks[i - 1].position;
      if (gap < MIN_POSITION_GAP) {
        return true;
      }
    }
    return false;
  }

  private sanitize(task: ITaskLean): ITaskSafe {
    return {
      id: task._id.toString(),
      orgId: task.orgId.toString(),
      boardId: task.boardId.toString(),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      position: task.position,
      assigneeIds: task.assigneeIds.map((id) => id.toString()),
      reporterId: task.reporterId.toString(),
      labels: task.labels,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}
