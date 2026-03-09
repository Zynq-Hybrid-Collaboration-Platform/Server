import { Request, Response } from "express";
import { OrganizationService } from "./organizationService";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";

/**
 * Organization Controller — HTTP layer only.
 *
 * Rules:
 * - Extract validated data from req.body / req.params
 * - Delegate all logic to OrganizationService
 * - Format HTTP response via sendSuccess
 * - ZERO business logic
 * - ZERO direct database calls
 */
export class OrganizationController {
  private organizationService: OrganizationService;

  constructor(organizationService: OrganizationService) {
    this.organizationService = organizationService;
  }

  /**
   * POST /api/v1/organizations/register
   * PUBLIC — no authentication required.
   *
   * Creates a new organization and returns its human-readable join code.
   * The code (ORG-XXXXXX) is used by users when calling POST /api/v1/auth/register-user.
   */
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

  /**
   * POST /api/v1/organizations
   * PROTECTED — authenticated user becomes OWNER.
   */
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

  getUserOrganizations = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const organizations = await this.organizationService.getUserOrganizations(
        authReq.user.userId,
      );
      sendSuccess(res, { organizations });
    },
  );

  getOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const organization =
        await this.organizationService.getOrganization(orgId);
      sendSuccess(res, { organization });
    },
  );

  getSidebar = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const sidebar = await this.organizationService.getSidebar(orgId);
      sendSuccess(res, sidebar);
    },
  );

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
