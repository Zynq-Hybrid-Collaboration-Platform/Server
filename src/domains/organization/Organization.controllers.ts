import { Request, Response } from "express";
import { OrganizationService } from "./organizationService";
import { catchAsync } from "../../core/middleware/async-handler";
import { sendSuccess } from "../../core/utils/response";
import { IAuthenticatedRequest } from "../../core/types/request.types";

/**
 * Organization Controller — HTTP layer only.
 *
 * Rules:
 * - Extract validated data from req
 * - Call service
 * - Format response
 * - ZERO business logic
 * - ZERO DB calls
 */
export class OrganizationController {
  private organizationService: OrganizationService;
  constructor(organizationService: OrganizationService) {
    this.organizationService = organizationService;
  }
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
        {
          message: "Organization created successfully",
          organization,
        },
        201,
      );
    },
  );

  /**
   * GET /api/v1/organizations
   *
   * Returns all organizations of logged-in user
   */
  getUserOrganizations = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const organizations = await this.organizationService.getUserOrganizations(
        authReq.user.userId,
      );
      sendSuccess(res, { organizations });
    },
  );

  /**
   * GET /api/v1/organizations/:orgId
   *
   * Fetch single organization profile
   */
  getOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;

      const organization =
        await this.organizationService.getOrganization(orgId);

      sendSuccess(res, { organization });
    },
  );

  /**
   * GET /api/v1/organizations/:orgId/sidebar
   *
   * Returns Discord-style sidebar structure:
   *  - Organization info
   *  - Categories sorted by position
   *  - Channels grouped inside categories
   */
  getSidebar = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { orgId } = req.params;
      const sidebar = await this.organizationService.getSidebar(orgId);
      sendSuccess(res, sidebar);
    },
  );

  /**
   * DELETE /api/v1/organizations/:orgId
   *
   * Only owner allowed (checked in service)
   */
  deleteOrganization = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const authReq = req as IAuthenticatedRequest;
      const { orgId } = req.params;

      await this.organizationService.deleteOrganization(
        authReq.user.userId,
        orgId,
      );
      sendSuccess(res, {
        message: "Organization deleted successfully",
      });
    },
  );

  /**
   * GET /api/v1/organizations/home
   *
   * Unified endpoint to load everything needed for the dashboard.
   */
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
