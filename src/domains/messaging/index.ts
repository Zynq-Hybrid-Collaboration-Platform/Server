// ─────────────────────────────────────────────────────
// Messaging Domain — Public API
// ─────────────────────────────────────────────────────

export { MessagingService } from "./messaging.service";
export { MessagingController } from "./messaging.controller";
export { MessagingRepository } from "./messaging.repository";
export type {
  IMessageSafe,
  IPaginatedMessages,
  MessageEvent,
  MessageType,
} from "./messaging.types";
