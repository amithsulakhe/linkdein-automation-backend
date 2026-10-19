import { AuditLog } from '../models/AuditLog.js';

export async function recordAudit({
  userId,
  action,
  resourceType,
  resourceId,
  previousState,
  newState,
  metadata,
  req,
}) {
  await AuditLog.create({
    userId,
    action,
    resourceType,
    resourceId: resourceId?.toString(),
    previousState,
    newState,
    metadata,
    ip: req?.ip,
    userAgent: req?.get?.('user-agent'),
  });
}
