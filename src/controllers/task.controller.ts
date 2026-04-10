import { Request, Response } from "express";
import { Types } from "mongoose";
import { Task, TaskStatus } from "../models/task.model";
import { Channel, ChannelType } from "../models/channel.model";
import WorkspaceModel from "../models/workspace.model";
import { catchAsync } from "../middleware/async-handler";
import { sendSuccess } from "../utils/response";
import { AuthorizationError } from "../errors/AuthorizationError";
import { NotFoundError } from "../errors/NotFoundError";
import { ValidationError } from "../errors/ValidationError";

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/**
 * Resolve the user's org role for a given workspace.
 * Returns { workspace, membership } or throws.
 */
async function resolveOrgRole(user: any, workspaceId: string | Types.ObjectId) {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace");

  const membership = user.organizations.find(
    (o: any) => o.orgId === workspace.orgId.toString(),
  );
  return { workspace, membership };
}

/**
 * Verify that user IDs are members of the given channel's workspace.
 * Enforces channel-specific assignment.
 */
async function validateChannelAssignees(
  channel: any,
  assigneeIds: string[],
): Promise<void> {
  const workspace = await WorkspaceModel.findById(channel.workspaceId);
  if (!workspace) throw new NotFoundError("Workspace");

  const workspaceMemberIds = workspace.members.map((m: any) =>
    m.userId.toString(),
  );

  // Check user has access to the channel based on allowedRoles
  // For now, we only check workspace membership since channel access
  // is role-based, not user-based
  const invalidUsers = assigneeIds.filter(
    (id) => !workspaceMemberIds.includes(id),
  );

  if (invalidUsers.length > 0) {
    throw new ValidationError(
      `The following users are not members of this workspace: ${invalidUsers.join(", ")}`,
    );
  }
}

// ─────────────────────────────────────────────────────────
// CREATE TASK (Admin only)
// ─────────────────────────────────────────────────────────

export const createTask = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { title, description, priority, channelId, assignees, dueDate } =
      req.body;
    const user = (req as any).user;

    // 1. Verify the channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) throw new NotFoundError("Channel");

    // 2. Verify the user is an admin or owner of the org that owns the workspace
    const { workspace, membership } = await resolveOrgRole(
      user,
      channel.workspaceId,
    );
    if (!membership || !["admin", "owner"].includes(membership.role)) {
      throw new AuthorizationError("Only organization admins or owners can create tasks");
    }

    // 3. Validate assignees are workspace members
    if (assignees && assignees.length > 0) {
      await validateChannelAssignees(channel, assignees);
    }

    // 4. Create the task
    const task = await Task.create({
      title,
      description: description || "",
      priority,
      status: TaskStatus.TODO,
      channelId: new Types.ObjectId(channelId),
      workspaceId: channel.workspaceId,
      orgId: workspace.orgId,
      createdBy: new Types.ObjectId(user.userId),
      assignees: (assignees || []).map((id: string) => new Types.ObjectId(id)),
      dueDate: dueDate || null,
    });

    // 5. Populate and return
    const populated = await Task.findById(task._id)
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar");

    sendSuccess(res, { task: populated }, 201);
  },
);

// ─────────────────────────────────────────────────────────
// GET TASKS BY CHANNEL
// ─────────────────────────────────────────────────────────

export const getTasksByChannel = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.params;
    const { status, assignee, priority, page = "1", limit = "20" } = req.query;

    const channel = await Channel.findById(channelId);
    if (!channel) throw new NotFoundError("Channel");

    // Build filter
    const filter: any = { channelId: new Types.ObjectId(channelId) };

    if (status && typeof status === "string") {
      filter.status = status.toUpperCase();
    }

    if (assignee && typeof assignee === "string") {
      filter.assignees = new Types.ObjectId(assignee);
    }

    if (priority && typeof priority === "string") {
      filter.priority = priority.toUpperCase();
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate("assignees", "name email avatar")
        .populate("createdBy", "name email avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Task.countDocuments(filter),
    ]);

    sendSuccess(
      res,
      { tasks },
      200,
      {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    );
  },
);

// ─────────────────────────────────────────────────────────
// GET TASKS BY WORKSPACE
// ─────────────────────────────────────────────────────────

export const getTasksByWorkspace = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { workspaceId } = req.params;
    const { status, priority } = req.query;

    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) throw new NotFoundError("Workspace");

    const filter: any = { workspaceId: new Types.ObjectId(workspaceId) };

    if (status && typeof status === "string") {
      filter.status = status.toUpperCase();
    }
    if (priority && typeof priority === "string") {
      filter.priority = priority.toUpperCase();
    }

    const tasks = await Task.find(filter)
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar")
      .sort({ createdAt: -1 });

    sendSuccess(res, { tasks });
  },
);

// ─────────────────────────────────────────────────────────
// GET MY TASKS (assigned to current user)
// ─────────────────────────────────────────────────────────

export const getMyTasks = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as any).user;
    const { status, priority } = req.query;

    const filter: any = { assignees: new Types.ObjectId(user.userId) };

    if (status && typeof status === "string") {
      filter.status = status.toUpperCase();
    }
    if (priority && typeof priority === "string") {
      filter.priority = priority.toUpperCase();
    }

    const tasks = await Task.find(filter)
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar")
      .populate("channelId", "name")
      .sort({ createdAt: -1 });

    sendSuccess(res, { tasks });
  },
);

// ─────────────────────────────────────────────────────────
// GET SINGLE TASK
// ─────────────────────────────────────────────────────────

export const getTaskById = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;

    const task = await Task.findById(taskId)
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar")
      .populate("channelId", "name type");

    if (!task) throw new NotFoundError("Task");

    sendSuccess(res, { task });
  },
);

// ─────────────────────────────────────────────────────────
// UPDATE TASK (Admin only)
// ─────────────────────────────────────────────────────────

export const updateTask = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;
    const user = (req as any).user;

    const task = await Task.findById(taskId);
    if (!task) throw new NotFoundError("Task");

    // Verify admin or owner role
    const { membership } = await resolveOrgRole(user, task.workspaceId);
    if (!membership || !["admin", "owner"].includes(membership.role)) {
      throw new AuthorizationError("Only organization admins or owners can update tasks");
    }

    const { title, description, priority, dueDate } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (dueDate !== undefined) updateData.dueDate = dueDate;

    const updated = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
    })
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar");

    sendSuccess(res, { task: updated });
  },
);

// ─────────────────────────────────────────────────────────
// DELETE TASK (Admin only)
// ─────────────────────────────────────────────────────────

export const deleteTask = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;
    const user = (req as any).user;

    const task = await Task.findById(taskId);
    if (!task) throw new NotFoundError("Task");

    // Verify admin or owner role
    const { membership } = await resolveOrgRole(user, task.workspaceId);
    if (!membership || !["admin", "owner"].includes(membership.role)) {
      throw new AuthorizationError("Only organization admins or owners can delete tasks");
    }

    await Task.findByIdAndDelete(taskId);

    sendSuccess(res, { message: "Task deleted successfully" });
  },
);

// ─────────────────────────────────────────────────────────
// ASSIGN USERS TO TASK (Admin only)
// ─────────────────────────────────────────────────────────

export const assignTask = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;
    const { assignees } = req.body;
    const user = (req as any).user;

    const task = await Task.findById(taskId);
    if (!task) throw new NotFoundError("Task");

    // Verify admin or owner role
    const { membership } = await resolveOrgRole(user, task.workspaceId);
    if (!membership || !["admin", "owner"].includes(membership.role)) {
      throw new AuthorizationError(
        "Only organization admins or owners can assign tasks",
      );
    }

    // Validate assignees belong to the channel's workspace
    const channel = await Channel.findById(task.channelId);
    if (!channel) throw new NotFoundError("Channel");

    await validateChannelAssignees(channel, assignees);

    // Use $addToSet to avoid duplicates
    const updated = await Task.findByIdAndUpdate(
      taskId,
      {
        $addToSet: {
          assignees: {
            $each: assignees.map((id: string) => new Types.ObjectId(id)),
          },
        },
      },
      { new: true },
    )
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar");

    sendSuccess(res, { task: updated });
  },
);

// ─────────────────────────────────────────────────────────
// UNASSIGN USERS FROM TASK (Admin only)
// ─────────────────────────────────────────────────────────

export const unassignTask = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;
    const { assignees } = req.body;
    const user = (req as any).user;

    const task = await Task.findById(taskId);
    if (!task) throw new NotFoundError("Task");

    // Verify admin or owner role
    const { membership } = await resolveOrgRole(user, task.workspaceId);
    if (!membership || !["admin", "owner"].includes(membership.role)) {
      throw new AuthorizationError(
        "Only organization admins or owners can unassign tasks",
      );
    }

    const updated = await Task.findByIdAndUpdate(
      taskId,
      {
        $pull: {
          assignees: {
            $in: assignees.map((id: string) => new Types.ObjectId(id)),
          },
        },
      },
      { new: true },
    )
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar");

    sendSuccess(res, { task: updated });
  },
);

// ─────────────────────────────────────────────────────────
// UPDATE TASK STATUS (Assignee or Admin)
// ─────────────────────────────────────────────────────────

export const updateTaskStatus = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = (req as any).user;

    const task = await Task.findById(taskId);
    if (!task) throw new NotFoundError("Task");

    // Check if user is admin/owner OR an assignee
    const { membership } = await resolveOrgRole(user, task.workspaceId);
    const isAdmin = membership && ["admin", "owner"].includes(membership.role);
    const isAssignee = task.assignees.some(
      (a: Types.ObjectId) => a.toString() === user.userId,
    );

    if (!isAdmin && !isAssignee) {
      throw new AuthorizationError(
        "Only admins, owners or assigned users can change task status",
      );
    }

    // Build status update
    const updateData: any = { status };

    // Auto-set completedAt when moving to COMPLETED
    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    // Clear completedAt if moving away from COMPLETED
    if (status !== TaskStatus.COMPLETED && task.status === TaskStatus.COMPLETED) {
      updateData.completedAt = null;
    }

    const updated = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
    })
      .populate("assignees", "name email avatar")
      .populate("createdBy", "name email avatar");

    sendSuccess(res, { task: updated });
  },
);
