import { Request, Response } from "express";
import * as orgService from "./organizationService";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";

// ─────────────────────────────────────────────────────
// HTTP layer only: extract from req → call service → send response
// ─────────────────────────────────────────────────────

/** GET /api/v1/organizations — list user's orgs */
export const getUserOrganizations = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthenticatedRequest;
    const organizations = await orgService.getUserOrganizations(
      authReq.user.userId,
    );

    sendSuccess(res, { organizations });
  },
);

/** GET /api/v1/organizations/:orgId — single org */
export const getOrganization = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { orgId } = req.params;
    const organization = await orgService.getOrganization(orgId);

    sendSuccess(res, { organization });
  },
);

/** DELETE /api/v1/organizations/:orgId — admin only */
export const deleteOrganization = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const authReq = req as IAuthenticatedRequest;
    const { orgId } = req.params;

    await orgService.deleteOrganization(authReq.user.userId, orgId);

    sendSuccess(res, { message: "Organization deleted successfully" });
  },
);

/** POST /api/v1/organizations/:orgId/members — add member */
export const addMember = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { orgId } = req.params;
    const { userId } = req.body;

    const organization = await orgService.addOrgMember(orgId, userId);

    sendSuccess(res, { message: "Member added successfully", organization });
  },
);

/** DELETE /api/v1/organizations/:orgId/members/:userId — remove member */
export const removeMember = catchAsync(
  async (req: Request, res: Response): Promise<void> => {
    const { orgId, userId } = req.params;

    const organization = await orgService.removeOrgMember(orgId, userId);

    sendSuccess(res, { message: "Member removed successfully", organization });
  },
);
