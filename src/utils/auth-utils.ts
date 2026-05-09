import { Types } from "mongoose";
import WorkspaceModel from "../models/workspace.model";
import { NotFoundError } from "../errors/NotFoundError";

/**
 * Resolve the user's org role for a given workspace.
 * Returns { workspace, membership } or throws.
 */
export async function resolveOrgRole(user: any, workspaceId: string | Types.ObjectId) {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) throw new NotFoundError("Workspace");

  const membership = user.organizations.find(
    (o: any) => o.orgId === workspace.orgId.toString(),
  );
  return { workspace, membership };
}
