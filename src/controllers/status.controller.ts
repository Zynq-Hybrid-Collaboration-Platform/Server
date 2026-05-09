import { Request, Response } from "express";
import { Types } from "mongoose";
import { Status } from "../models/status.model";
import { Task } from "../models/task.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { NotFoundError } from "../errors/NotFoundError";
import { ValidationError } from "../errors/ValidationError";
import { AuthorizationError } from "../errors/AuthorizationError";
import WorkspaceModel from "../models/workspace.model";

// ─────────────────────────────────────────────────────────
// CRUD Statuses
// ─────────────────────────────────────────────────────────

export const createStatus = catchAsync(async (req: Request, res: Response) => {
  const { name, workspaceId, isCompleted, order, color } = req.body;

  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace not found");

  const user = (req as any).user;
  const membership = user.organizations.find(
    (o: any) => o.orgId === workspace.orgId.toString()
  );

  if (!membership || !["admin", "owner"].includes(membership.role)) {
    throw new AuthorizationError("Only organization admins or owners can manage board columns.");
  }

  const status = await Status.create({
    name,
    workspaceId: new Types.ObjectId(workspaceId),
    isCompleted: isCompleted || false,
    order: order || 0,
    color: color || "#cbd5e1",
  });

  sendSuccess(res, { status }, 201);
});

export const getStatusesByWorkspace = catchAsync(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;

  const statuses = await Status.find({ workspaceId: new Types.ObjectId(workspaceId) })
    .sort({ order: 1 });

  sendSuccess(res, { statuses });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const { statusId } = req.params;
  const { name, isCompleted, order, color } = req.body;

  const status = await Status.findById(statusId);
  if (!status) throw new NotFoundError("Status not found");

  const workspace = await WorkspaceModel.findById(status.workspaceId);
  const user = (req as any).user;
  const membership = user.organizations.find(
    (o: any) => o.orgId === workspace?.orgId.toString()
  );

  if (!membership || !["admin", "owner"].includes(membership.role)) {
    throw new AuthorizationError("Only organization admins or owners can manage board columns.");
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (order !== undefined) updates.order = order;
  if (color !== undefined) updates.color = color;

  const updated = await Status.findByIdAndUpdate(statusId, updates, { new: true });

  sendSuccess(res, { status: updated });
});

export const deleteStatus = catchAsync(async (req: Request, res: Response) => {
  const { statusId } = req.params;

  const status = await Status.findById(statusId);
  if (!status) throw new NotFoundError("Status not found");

  const workspace = await WorkspaceModel.findById(status.workspaceId);
  const user = (req as any).user;
  const membership = user.organizations.find(
    (o: any) => o.orgId === workspace?.orgId.toString()
  );

  if (!membership || !["admin", "owner"].includes(membership.role)) {
    throw new AuthorizationError("Only organization admins or owners can manage board columns.");
  }

  // Check if there are tasks in this status
  const taskCount = await Task.countDocuments({ statusId: status._id });
  if (taskCount > 0) {
    throw new ValidationError("Cannot delete status that contains tasks. Please move tasks to another status first.");
  }

  await Status.findByIdAndDelete(statusId);

  sendSuccess(res, { message: "Status deleted successfully" });
});

// ─────────────────────────────────────────────────────────
// Seeding Logic
// ─────────────────────────────────────────────────────────

export const seedDefaultStatuses = async (workspaceId: Types.ObjectId) => {
  const defaults = [
    { name: "Todo", order: 0, color: "#cbd5e1", isCompleted: false },
    { name: "Ongoing", order: 1, color: "#3b82f6", isCompleted: false },
    { name: "Done", order: 2, color: "#22c55e", isCompleted: true },
  ];

  const statuses = await Promise.all(
    defaults.map((d) =>
      Status.create({
        ...d,
        workspaceId,
      })
    )
  );

  return statuses;
};
