import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
// import { validate } from "../../core/middleware/validate.middleware";
import { OrganizationController } from "./Organization.controllers";
import { OrganizationService } from "./organizationService";
import { OrganizationRepository } from "./organizationRepository";
import { MemberRepository } from "../member/memberRepository";

// ─────────────────────────────────────────────────────
// Dependency Assembly (Repository → Service → Controller)
// ─────────────────────────────────────────────────────

const organizationRepository = new OrganizationRepository();
const memberRepository = new MemberRepository();

export const organizationService = new OrganizationService(
  organizationRepository,
  memberRepository,
);
const organizationController = new OrganizationController(organizationService);

const router = Router();
// ─────────────────────────────────────────────────────
// Organization Routes
// Base path (when mounted): /api/v1/organizations
// ─────────────────────────────────────────────────────

/**
 * GET /home
 * unified loader for homepage data (all servers user belongs to)
 */
router.get(
  "/home",
  authenticate as never,
  organizationController.getHomeData,
);

/**
 * POST /
 * Create a new organization for the authenticated user.
 */
router.post(
  "/",
  authenticate as never,
  // validate(createOrganizationSchema),
  organizationController.createOrganization,
);

/**
 * GET /
 * Get all organizations owned by the authenticated user.
 */
router.get(
  "/",
  authenticate as never,
  organizationController.getUserOrganizations,
);

/**
 * GET /:orgId
 * Get a single organization by id.
 */
router.get(
  "/:orgId",
  authenticate as never,
  organizationController.getOrganization,
);

/**
 * GET /:orgId/sidebar
 * Get sidebar structure for the organization.
 */
router.get(
  "/:orgId/sidebar",
  authenticate as never,
  organizationController.getSidebar,
);

/**
 * DELETE /:orgId
 * Delete an organization (only owner is allowed; enforced in service).
 */
router.delete(
  "/:orgId",
  authenticate as never,
  organizationController.deleteOrganization,
);

export { router as organizationRoutes };
