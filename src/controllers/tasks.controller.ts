import { Request, Response } from "express";
import { EventEmitter } from "events";
import { Types } from "mongoose";
import { TaskModel } from "../models/tasks.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { ITenantRequest } from "../types/request.types";
import { logger } from "../logger/logger";
import {
  ITaskLean,
  ITaskSafe,
  TaskStatus,
  TaskPriority,
  TaskEvent,
} from "../types/tasks.types";
import { NotFoundError } from "../errors";

const POSITION_GAP = 65536;
const MIN_POSITION_GAP = 0.001;
const DEFAULT_PAGE_SIZE = 50;
export const events = new EventEmitter();

// ─────────────────────────────────────────────────────
// Private Helpers
// ─────────────────────────────────────────────────────

function sanitize(task: ITaskLean): ITaskSafe {
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

async function findByColumn(orgId: string, boardId: string, status: TaskStatus): Promise<ITaskLean[]> {
  return TaskModel.find({
    orgId: new Types.ObjectId(orgId),
    boardId: new Types.ObjectId(boardId),
    status,
  })
    .sort({ position: 1 })
    .lean<ITaskLean[]>();
}

async function rebalanceColumn(orgId: string, boardId: string, status: TaskStatus): Promise<void> {
  const tasks = await findByColumn(orgId, boardId, status);
  const bulkOps = tasks.map((task, index) => ({
    updateOne: {
      filter: { _id: task._id },
      update: { position: (index + 1) * POSITION_GAP },
    },
  }));
  if (bulkOps.length > 0) await TaskModel.bulkWrite(bulkOps);
}

// ─────────────────────────────────────────────────────
// HTTP Handlers
// ─────────────────────────────────────────────────────

export const getTask = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { taskId } = req.params;
  const orgId = tenantReq.tenantContext.orgId;

  const task = await TaskModel.findOne({ _id: taskId, orgId }).lean<ITaskLean>();
  if (!task) throw new NotFoundError("Task");
  sendSuccess(res, sanitize(task));
});

export const getBoardTasks = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { boardId } = req.params;
  const orgId = tenantReq.tenantContext.orgId;
  const status = req.query.status as TaskStatus | undefined;
  const cursor = req.query.cursor as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : DEFAULT_PAGE_SIZE;

  const filter: Record<string, unknown> = {
    orgId: new Types.ObjectId(orgId),
    boardId: new Types.ObjectId(boardId),
  };
  if (status) filter.status = status;
  if (cursor) filter.position = { $gt: parseFloat(cursor) };

  const tasks = await TaskModel.find(filter)
    .sort({ status: 1, position: 1 })
    .limit(limit + 1)
    .lean<ITaskLean[]>();

  const hasMore = tasks.length > limit;
  if (hasMore) tasks.pop();

  const safeTasks = tasks.map(sanitize);
  const nextCursor = safeTasks.length > 0 ? String(safeTasks[safeTasks.length - 1].position) : null;

  sendSuccess(res, { tasks: safeTasks, nextCursor, hasMore });
});

export const createTask = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { title, description, boardId, status, priority, assigneeIds, labels, dueDate } = req.body;
  const orgId = tenantReq.tenantContext.orgId;
  const reporterId = tenantReq.tenantContext.userId;
  const taskStatus = status ?? TaskStatus.BACKLOG;

  const last = await TaskModel.findOne({
    orgId: new Types.ObjectId(orgId),
    boardId: new Types.ObjectId(boardId),
    status: taskStatus,
  })
    .sort({ position: -1 })
    .select("position")
    .lean<{ position: number } | null>();

  const position = (last ? last.position : 0) + POSITION_GAP;

  const doc = await TaskModel.create({
    orgId,
    boardId,
    title,
    description: description ?? "",
    status: taskStatus,
    priority: priority ?? TaskPriority.NONE,
    position,
    assigneeIds: (assigneeIds ?? []).map((id: string) => new Types.ObjectId(id)),
    reporterId: new Types.ObjectId(reporterId),
    labels: labels ?? [],
    dueDate: dueDate ? new Date(dueDate) : null,
  });

  const safe = sanitize(doc.toObject() as unknown as ITaskLean);
  events.emit(TaskEvent.CREATED, { orgId, task: safe });
  sendSuccess(res, safe, 201);
});

export const updateTask = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { taskId } = req.params;
  const orgId = tenantReq.tenantContext.orgId;
  const dto = req.body;

  const updateData: Record<string, unknown> = {};
  if (dto.title !== undefined) updateData.title = dto.title;
  if (dto.description !== undefined) updateData.description = dto.description;
  if (dto.priority !== undefined) updateData.priority = dto.priority;
  if (dto.labels !== undefined) updateData.labels = dto.labels;
  if (dto.dueDate === null) updateData.dueDate = null;
  else if (dto.dueDate) updateData.dueDate = new Date(dto.dueDate);
  if (dto.assigneeIds !== undefined) {
    updateData.assigneeIds = dto.assigneeIds.map((id: string) => new Types.ObjectId(id));
  }

  const updated = await TaskModel.findOneAndUpdate({ _id: taskId, orgId }, updateData, { new: true }).lean<ITaskLean>();
  if (!updated) throw new NotFoundError("Task");

  const safe = sanitize(updated);
  events.emit(TaskEvent.UPDATED, { orgId, task: safe });
  sendSuccess(res, safe);
});

export const moveTask = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { taskId } = req.params;
  const { status, position } = req.body;
  const orgId = tenantReq.tenantContext.orgId;

  const existing = await TaskModel.findOne({ _id: taskId, orgId }).lean<ITaskLean>();
  if (!existing) throw new NotFoundError("Task");

  const moved = await TaskModel.findOneAndUpdate({ _id: taskId, orgId }, { status, position }, { new: true }).lean<ITaskLean>();
  if (!moved) throw new NotFoundError("Task");

  const columnTasks = await findByColumn(orgId, existing.boardId.toString(), status);
  let needsRebalance = false;
  for (let i = 1; i < columnTasks.length; i++) {
    if (columnTasks[i].position - columnTasks[i - 1].position < MIN_POSITION_GAP) {
      needsRebalance = true;
      break;
    }
  }

  if (needsRebalance) {
    await rebalanceColumn(orgId, existing.boardId.toString(), status);
  }

  const safe = sanitize(moved);
  events.emit(TaskEvent.MOVED, {
    orgId,
    taskId,
    fromStatus: existing.status,
    toStatus: status,
    task: safe,
  });
  sendSuccess(res, safe);
});

export const deleteTask = catchAsync(async (req: Request, res: Response): Promise<void> => {
  const tenantReq = req as unknown as ITenantRequest;
  const { taskId } = req.params;
  const orgId = tenantReq.tenantContext.orgId;

  const existing = await TaskModel.findOne({ _id: taskId, orgId }).lean<ITaskLean>();
  if (!existing) throw new NotFoundError("Task");

  await TaskModel.deleteOne({ _id: taskId, orgId });
  events.emit(TaskEvent.DELETED, { orgId, taskId, boardId: existing.boardId.toString() });
  sendSuccess(res, { message: "Task deleted" });
});
