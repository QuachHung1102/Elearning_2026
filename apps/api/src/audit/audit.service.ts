import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AUDIT_VOCABULARY,
  type AuditAction,
  type AuditMetadata,
} from './actions.js';

export type AuditActorContext = {
  /** `null` means the system (payment callback, reconcile job). */
  actorId: string | null;
  ipAddress: string | null;
};

export type AuditEntry<A extends AuditAction> = AuditActorContext & {
  action: A;
  entityType: (typeof AUDIT_VOCABULARY)[A]['entityType'];
  entityId?: string | null;
  /** Never secrets, password hashes, session tokens or raw provider payloads. */
  metadata: AuditMetadata<A>;
};

/**
 * Append-only. Nothing in the application updates or deletes `audit_logs`.
 * Callers pass the transaction of the mutation being recorded, so the row
 * exists if and only if the change does.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record<A extends AuditAction>(
    entry: AuditEntry<A>,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata as Prisma.InputJsonObject,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
