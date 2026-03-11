import { Request, Response } from "express";
import { OrganizationService } from "./organizationService";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";

export class OrganizationController {
  private organizationService: OrganizationService;

  constructor(organizationService: OrganizationService) {
    this.organizationService = organizationService;
  }

  /** POST /api/v1/organizations/register — public registration */
  registerOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { name, slug } = req.body;

      const result = await this.organizationService.registerOrganization({
        name,
        slug,
      });

      sendSuccess(
        res,
        {
          message: "Organization created successfully",
          organizationId: result.organization._id,
          organizationCode: result.organizationCode,
        },
        201,
      );
    },
  );

  /** POST /api/v1/organizations — authenticated user becomes OWNER */
  createOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const { name, slug } = req.body;

      const organization = await this.organizationService.createOrganization(
        authReq.user.userId,
        { name, slug },
      );

      sendSuccess(
        res,
        { message: "Organization created successfully", organization },
        201,
      );
    },
  );

  /** GET /api/v1/organizations — list user's orgs */
  getUserOrganizations = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const organizations = await this.organizationService.getUserOrganizations(
        authReq.user.userId,
      );
      sendSuccess(res, { organizations });
    },
  );

  /** GET /api/v1/organizations/:orgId — single org */
  getOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const organization =
        await this.organizationService.getOrganization(orgId);
      sendSuccess(res, { organization });
    },
  );

  /** GET /api/v1/organizations/:orgId/sidebar */
  getSidebar = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const sidebar = await this.organizationService.getSidebar(orgId);
      sendSuccess(res, sidebar);
    },
  );

  /** DELETE /api/v1/organizations/:orgId — admin/owner only */
  deleteOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const { orgId } = req.params;

      await this.organizationService.deleteOrganization(
        authReq.user.userId,
        orgId,
      );
      sendSuccess(res, { message: "Organization deleted successfully" });
    },
  );

  /** POST /api/v1/organizations/:orgId/members — add member */
  addMember = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const { userId } = req.body;

      const organization = await this.organizationService.addOrgMember(
        orgId,
        userId,
      );

      sendSuccess(res, { message: "Member added successfully", organization });
    },
  );

  /** DELETE /api/v1/organizations/:orgId/members/:userId — remove member */
  removeMember = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId, userId } = req.params;

      const organization = await this.organizationService.removeOrgMember(
        orgId,
        userId,
      );

      sendSuccess(res, { message: "Member removed successfully", organization });
    },
  );

  /** GET /api/v1/organizations/home */
  getHomeData = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const data = await this.organizationService.getHomeData(
        authReq.user.userId,
      );
      sendSuccess(res, { data });
    },
  );
}
