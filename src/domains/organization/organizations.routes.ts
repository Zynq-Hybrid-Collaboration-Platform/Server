import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import { validate } from "../../core/middleware/validate.middleware";
import { OrganizationController } from "./Organization.controllers";
import { OrganizationService } from "./organizationService";
import { OrganizationRepository } from "./organizationRepository";
import { MemberRepository } from "../member/memberRepository";
import { orgRegistrationSchema } from "./organization.validator";

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
// Public Routes (no authentication required)
// Base path (when mounted): /api/v1/organizations
//
// IMPORTANT: static paths like /register MUST appear before dynamic
// paths like /:orgId — Express matches routes in declaration order.
// ─────────────────────────────────────────────────────

router.post(
  "/register",
  validate(orgRegistrationSchema),
  organizationController.registerOrganization,
);

// ─────────────────────────────────────────────────────
// Protected Routes (JWT authentication required)
// ─────────────────────────────────────────────────────

router.get(
  "/home",
  authenticate as never,
  organizationController.getHomeData,
);

router.post(
  "/",
  authenticate as never,
  organizationController.createOrganization,
);

router.get(
  "/",
  authenticate as never,
  organizationController.getUserOrganizations,
);

router.get(
  "/:orgId",
  authenticate as never,
  organizationController.getOrganization,
);

router.get(
  "/:orgId/sidebar",
  authenticate as never,
  organizationController.getSidebar,
);

router.delete(
  "/:orgId",
  authenticate as never,
  organizationController.deleteOrganization,
);

// Member management routes (from main)
router.post(
  "/:orgId/members",
  authenticate as never,
  organizationController.addMember,
);

router.delete(
  "/:orgId/members/:userId",
  authenticate as never,
  organizationController.removeMember,
);

export { router as organizationRoutes };
