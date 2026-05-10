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
import { resolveOrgRole } from "../utils/auth-utils";

// ─────────────────────────────────────────────────────────
// CRUD Statuses
// ─────────────────────────────────────────────────────────

export const createStatus = catchAsync(async (req: Request, res: Response) => {
  const { name, workspaceId, isCompleted, order, color } = req.body;

  const user = (req as any).user;
  const { membership } = await resolveOrgRole(user, workspaceId);

  if (!membership) {
    throw new AuthorizationError("You must be a member of this workspace to manage columns");
  }

  const status = await Status.create({
    name,
    workspaceId: new Types.ObjectId(workspaceId),
    isCompleted: isCompleted || false,
    order: order || 0,
    color: color || "#cbd5e1",
  });

  const io = req.app.get("io");
  if (io) {
    io.emit("status:created", { status });
  }

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

  const user = (req as any).user;
  const { membership } = await resolveOrgRole(user, status.workspaceId);

  if (!membership) {
    throw new AuthorizationError("You must be a member of this workspace to manage columns");
  }

  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (isCompleted !== undefined) updates.isCompleted = isCompleted;
  if (order !== undefined) updates.order = order;
  if (color !== undefined) updates.color = color;

  const updated = await Status.findByIdAndUpdate(statusId, updates, { new: true });

  const io = req.app.get("io");
  if (io && updated) {
    io.emit("status:updated", { status: updated });
  }

  sendSuccess(res, { status: updated });
});

export const deleteStatus = catchAsync(async (req: Request, res: Response) => {
  const { statusId } = req.params;

  const status = await Status.findById(statusId);
  if (!status) throw new NotFoundError("Status not found");

  const user = (req as any).user;
  const { membership } = await resolveOrgRole(user, status.workspaceId);

  if (!membership) {
    throw new AuthorizationError("You must be a member of this workspace to manage columns");
  }

  // Check if there are tasks in this status
  const taskCount = await Task.countDocuments({ statusId: status._id });
  if (taskCount > 0) {
    throw new ValidationError("Cannot delete status that contains tasks. Please move tasks to another status first.");
  }

  await Status.findByIdAndDelete(statusId);

  const io = req.app.get("io");
  if (io) {
    io.emit("status:deleted", { 
      statusId, 
      workspaceId: status.workspaceId.toString() 
    });
  }

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
