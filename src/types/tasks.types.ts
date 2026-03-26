import { Types } from "mongoose";

// ─────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────

export enum TaskStatus {
  BACKLOG = "backlog",
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  IN_REVIEW = "in_review",
  DONE = "done",
}

export enum TaskPriority {
  NONE = "none",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum TaskEvent {
  CREATED = "task.created",
  UPDATED = "task.updated",
  DELETED = "task.deleted",
  MOVED = "task.moved",
  ASSIGNED = "task.assigned",
}

// ─────────────────────────────────────────────────────────
// Document + Lean types
// ─────────────────────────────────────────────────────────

export interface ITaskDocument {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  boardId: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  assigneeIds: Types.ObjectId[];
  reporterId: Types.ObjectId;
  labels: string[];
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ITaskLean = Pick<
  ITaskDocument,
  | "_id"
  | "orgId"
  | "boardId"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "position"
  | "assigneeIds"
  | "reporterId"
  | "labels"
  | "dueDate"
  | "createdAt"
  | "updatedAt"
>;

// ─────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────

export interface ICreateTaskDTO {
  boardId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeIds?: string[];
  labels?: string[];
  dueDate?: string;
}

export interface IUpdateTaskDTO {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  assigneeIds?: string[];
  labels?: string[];
  dueDate?: string | null;
}

export interface IMoveTaskDTO {
  status: TaskStatus;
  position: number;
}

export interface ITaskListQuery {
  boardId: string;
  status?: TaskStatus;
  cursor?: string;
  limit?: number;
}

// ─────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────

export interface ITaskSafe {
  id: string;
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
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IPaginatedTasks {
  tasks: ITaskSafe[];
  nextCursor: string | null;
  hasMore: boolean;
}
