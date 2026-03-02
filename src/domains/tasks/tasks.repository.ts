import { Types } from "mongoose";
import { TaskModel } from "./tasks.model";
import { ITaskLean, TaskStatus, TaskPriority } from "./tasks.types";

const DEFAULT_PAGE_SIZE = 50;

/** Rebalance gap — tasks get positions in increments of this */
const POSITION_GAP = 65536;

/**
 * Tasks Repository — the ONLY file in the tasks domain that touches Mongoose.
 *
 * Uses fractional positioning for drag-and-drop column reordering.
 */
export class TasksRepository {
  // ─────────────────────────────────────────────────────
  // Reads
  // ─────────────────────────────────────────────────────

  async findById(orgId: string, taskId: string): Promise<ITaskLean | null> {
    return TaskModel.findOne({
      _id: taskId,
      orgId,
    }).lean<ITaskLean>();
  }

  /**
   * Get tasks in a board, optionally filtered by status.
   * Cursor-based pagination on position field.
   */
  async findByBoard(
    orgId: string,
    boardId: string,
    status?: TaskStatus,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE
  ): Promise<{ tasks: ITaskLean[]; hasMore: boolean }> {
    const filter: Record<string, unknown> = {
      orgId: new Types.ObjectId(orgId),
      boardId: new Types.ObjectId(boardId),
    };

    if (status) {
      filter.status = status;
    }

    if (cursor) {
      filter.position = { $gt: parseFloat(cursor) };
    }

    const tasks = await TaskModel.find(filter)
      .sort({ status: 1, position: 1 })
      .limit(limit + 1)
      .lean<ITaskLean[]>();

    const hasMore = tasks.length > limit;
    if (hasMore) {
      tasks.pop();
    }

    return { tasks, hasMore };
  }

  /**
   * Get all tasks in a specific column (status), sorted by position.
   * Used internally for rebalancing.
   */
  async findByColumn(
    orgId: string,
    boardId: string,
    status: TaskStatus
  ): Promise<ITaskLean[]> {
    return TaskModel.find({
      orgId: new Types.ObjectId(orgId),
      boardId: new Types.ObjectId(boardId),
      status,
    })
      .sort({ position: 1 })
      .lean<ITaskLean[]>();
  }

  /**
   * Get the maximum position in a column.
   * Used to place new tasks at the end.
   */
  async getMaxPosition(
    orgId: string,
    boardId: string,
    status: TaskStatus
  ): Promise<number> {
    const last = await TaskModel.findOne({
      orgId: new Types.ObjectId(orgId),
      boardId: new Types.ObjectId(boardId),
      status,
    })
      .sort({ position: -1 })
      .select("position")
      .lean<{ position: number } | null>();

    return last ? last.position : 0;
  }

  // ─────────────────────────────────────────────────────
  // Writes
  // ─────────────────────────────────────────────────────

  async create(data: {
    orgId: string;
    boardId: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    position: number;
    assigneeIds: string[];
    reporterId: string;
    labels: string[];
    dueDate: Date | null;
  }): Promise<ITaskLean> {
    const doc = await TaskModel.create({
      orgId: data.orgId,
      boardId: data.boardId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      position: data.position,
      assigneeIds: data.assigneeIds.map((id) => new Types.ObjectId(id)),
      reporterId: new Types.ObjectId(data.reporterId),
      labels: data.labels,
      dueDate: data.dueDate,
    });

    return doc.toObject() as unknown as ITaskLean;
  }

  async update(
    orgId: string,
    taskId: string,
    data: Partial<{
      title: string;
      description: string;
      priority: TaskPriority;
      assigneeIds: string[];
      labels: string[];
      dueDate: Date | null;
    }>
  ): Promise<ITaskLean | null> {
    const updateData: Record<string, unknown> = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.labels !== undefined) updateData.labels = data.labels;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.assigneeIds !== undefined) {
      updateData.assigneeIds = data.assigneeIds.map(
        (id) => new Types.ObjectId(id)
      );
    }

    return TaskModel.findOneAndUpdate(
      { _id: taskId, orgId },
      updateData,
      { new: true }
    ).lean<ITaskLean>();
  }

  async moveTask(
    orgId: string,
    taskId: string,
    status: TaskStatus,
    position: number
  ): Promise<ITaskLean | null> {
    return TaskModel.findOneAndUpdate(
      { _id: taskId, orgId },
      { status, position },
      { new: true }
    ).lean<ITaskLean>();
  }

  async delete(orgId: string, taskId: string): Promise<boolean> {
    const result = await TaskModel.deleteOne({ _id: taskId, orgId });
    return result.deletedCount > 0;
  }

  /**
   * Rebalance all positions in a column with even spacing.
   * Called when fractional positions get too close (precision loss).
   */
  async rebalanceColumn(
    orgId: string,
    boardId: string,
    status: TaskStatus
  ): Promise<void> {
    const tasks = await this.findByColumn(orgId, boardId, status);

    const bulkOps = tasks.map((task, index) => ({
      updateOne: {
        filter: { _id: task._id },
        update: { position: (index + 1) * POSITION_GAP },
      },
    }));

    if (bulkOps.length > 0) {
      await TaskModel.bulkWrite(bulkOps);
    }
  }
}
