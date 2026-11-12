import "server-only";

import { db } from "./db";
import { auditLogs } from "./db/schema";

type AuditEntry = {
  actorUserId?: string | null;
  actorName: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function writeAuditLog(entry: AuditEntry) {
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    actorName: entry.actorName,
    actorRole: entry.actorRole ?? "admin",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
  });
}
