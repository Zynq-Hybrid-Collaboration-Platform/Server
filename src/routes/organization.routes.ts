import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as orgController from "../controllers/organization.controller";
import { validate } from "../middleware/validate.middleware";
import { registerOrgSchema, addRoleSchema } from "../validators/organization.validator";

const router = Router();

router.post("/register", validate(registerOrgSchema), orgController.registerOrganization);
router.get("/list", orgController.getAllOrganizations);

router.get("/", authenticate as never, orgController.getUserOrganizations);
router.get("/:orgId", authenticate as never, orgController.getOrganization);
router.delete("/:orgId", authenticate as never, orgController.deleteOrganization);

router.get("/:orgId/members", authenticate as never, orgController.getOrganizationMembers);
router.post("/:orgId/members", authenticate as never, orgController.addMember);
router.delete("/:orgId/members/:userId", authenticate as never, orgController.removeMember);
router.put("/:orgId/members/:userId/role", authenticate as never, orgController.updateMemberRole);

router.get("/:orgId/roles", orgController.getOrgRoles);
router.post("/:orgId/roles", authenticate as never, validate(addRoleSchema), orgController.addOrgRole);
router.delete("/:orgId/roles/:role", authenticate as never, orgController.removeOrgRole);

export { router as organizationRoutes };
