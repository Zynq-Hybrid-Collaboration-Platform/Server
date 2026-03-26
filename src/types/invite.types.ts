// ─────────────────────────────────────────────────────────
// Invite Code Types & DTOs
// ─────────────────────────────────────────────────────────

export interface ICreateInviteDTO {
  organizationId: string;
  workspaceId: string;
  expiresInHours: number;
  maxUses?: number;
}

export interface IValidateInviteDTO {
  code: string;
}

export interface IInviteSafe {
  id: string;
  organizationId: string;
  workspaceId: string;
  code: string;
  expiresAt: string;
  createdBy: string;
  maxUses: number;
  uses: number;
  isActive: boolean;
  createdAt: string;
}

export interface IInviteValidationResult {
  valid: boolean;
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  workspaceName: string;
  roles: string[];
}
