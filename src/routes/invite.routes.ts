import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as inviteController from "../controllers/invite.controller";
import { validate } from "../middleware/validate.middleware";
import { createInviteSchema } from "../validators/invite.validator";

const router = Router();

router.get("/validate/:code", inviteController.validateInviteCode);

router.post(
  "/",
  authenticate as never,
  validate(createInviteSchema),
  inviteController.createInviteCode
);
router.get("/org/:orgId", authenticate as never, inviteController.getOrgInvites);
router.patch("/:inviteId/deactivate", authenticate as never, inviteController.deactivateInvite);
router.delete("/:inviteId", authenticate as never, inviteController.deleteInvite);

router.post("/join", authenticate as never, inviteController.joinWorkspace);

export { router as inviteRoutes };
