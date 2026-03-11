import { Router } from "express";
import { authenticate } from "../../core/middleware/auth.middleware";
import * as orgController from "./Organization.controllers";

const router = Router();

// ─────────────────────────────────────────────────────
// Organization Routes
// Base path (when mounted): /api/v1/organizations
// ─────────────────────────────────────────────────────

/** GET / — all orgs the user belongs to */
router.get("/", authenticate as never, orgController.getUserOrganizations);

/** GET /:orgId — single org */
router.get("/:orgId", authenticate as never, orgController.getOrganization);

/** DELETE /:orgId — delete org (admin only) */
router.delete("/:orgId", authenticate as never, orgController.deleteOrganization);

/** POST /:orgId/members — add member { userId } */
router.post("/:orgId/members", authenticate as never, orgController.addMember);

/** DELETE /:orgId/members/:userId — remove member */
router.delete("/:orgId/members/:userId", authenticate as never, orgController.removeMember);

export { router as organizationRoutes };
