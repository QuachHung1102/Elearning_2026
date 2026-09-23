/**
 * The closed audit vocabulary — one row per line of DATA_MODEL.md §AuditLog.
 * `keys` are the metadata keys that line requires; `AuditService.record`
 * checks both the entity type and those keys at compile time, so a writer
 * cannot invent an action or forget a key. Extra keys are allowed.
 *
 * Adding an action means adding a line here *and* in DATA_MODEL.md.
 */
export const AUDIT_ENTITY_TYPES = [
  'COURSE',
  'SECTION',
  'LESSON',
  'RESOURCE',
  'CATEGORY',
  'ENROLLMENT',
  'USER',
  'PURCHASE',
  'PAYMENT_ATTEMPT',
  'VIDEO_ASSET',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_VOCABULARY = {
  'course.created': { entityType: 'COURSE', keys: ['slug'] },
  'course.updated': { entityType: 'COURSE', keys: ['slug'] },
  'course.published': { entityType: 'COURSE', keys: ['slug'] },
  'course.unpublished': { entityType: 'COURSE', keys: ['slug', 'fromStatus'] },
  'course.archived': { entityType: 'COURSE', keys: ['slug'] },
  'course.deleted': { entityType: 'COURSE', keys: ['slug'] },
  'course.demo_stats_cleared': {
    entityType: 'COURSE',
    keys: ['slug', 'previousRatingAverage', 'previousRatingCount'],
  },
  'category.created': { entityType: 'CATEGORY', keys: ['slug'] },
  'category.updated': { entityType: 'CATEGORY', keys: ['slug'] },
  'category.deleted': { entityType: 'CATEGORY', keys: ['slug'] },
  'category.reordered': { entityType: 'CATEGORY', keys: ['categoryIds'] },
  'section.created': { entityType: 'SECTION', keys: ['courseId', 'title'] },
  'section.updated': { entityType: 'SECTION', keys: ['courseId', 'title'] },
  'section.deleted': { entityType: 'SECTION', keys: ['courseId', 'title'] },
  'section.reordered': { entityType: 'COURSE', keys: ['sectionIds'] },
  'lesson.created': { entityType: 'LESSON', keys: ['courseId', 'title'] },
  'lesson.updated': { entityType: 'LESSON', keys: ['courseId', 'title'] },
  'lesson.deleted': {
    entityType: 'LESSON',
    keys: ['courseId', 'title', 'deletedProgressRows'],
  },
  'lesson.reordered': { entityType: 'SECTION', keys: ['lessonIds'] },
  'resource.created': {
    entityType: 'RESOURCE',
    keys: ['lessonId', 'filename'],
  },
  'resource.deleted': {
    entityType: 'RESOURCE',
    keys: ['lessonId', 'filename'],
  },
  'video.attached': { entityType: 'LESSON', keys: ['videoAssetId'] },
  'video.detached': { entityType: 'LESSON', keys: ['videoAssetId'] },
  'enrollment.granted': {
    entityType: 'ENROLLMENT',
    keys: ['courseId', 'userId', 'source'],
  },
  'enrollment.revoked': {
    entityType: 'ENROLLMENT',
    keys: ['courseId', 'userId', 'reason', 'trigger'],
  },
  'user.blocked': { entityType: 'USER', keys: ['reason', 'revokedSessions'] },
  'user.unblocked': { entityType: 'USER', keys: [] },
  'user.role_changed': { entityType: 'USER', keys: ['fromRole', 'toRole'] },
  'purchase.paid': {
    entityType: 'PURCHASE',
    keys: ['courseId', 'priceVnd', 'appTransId'],
  },
  'purchase.refund_requested': { entityType: 'PURCHASE', keys: ['reason'] },
  'purchase.refund_approved': { entityType: 'PURCHASE', keys: ['reason'] },
  'purchase.refund_rejected': { entityType: 'PURCHASE', keys: ['reason'] },
  'purchase.refunded': { entityType: 'PURCHASE', keys: ['amountVnd'] },
  'purchase.cancelled': {
    entityType: 'PURCHASE',
    keys: ['lastAttemptId', 'expiredAt'],
  },
  'payment.reconciled': {
    entityType: 'PAYMENT_ATTEMPT',
    keys: ['appTransId', 'fromStatus', 'toStatus'],
  },
  'payment.callback_rejected': {
    entityType: 'PAYMENT_ATTEMPT',
    keys: ['appTransId', 'rejectReason'],
  },
  'payment.duplicate_paid': {
    entityType: 'PAYMENT_ATTEMPT',
    keys: ['appTransId', 'purchaseId', 'firstAttemptId'],
  },
} as const satisfies Record<
  string,
  { entityType: AuditEntityType; keys: readonly string[] }
>;

export type AuditAction = keyof typeof AUDIT_VOCABULARY;

export const AUDIT_ACTIONS = Object.keys(AUDIT_VOCABULARY) as AuditAction[];

export type AuditMetadata<A extends AuditAction> = Record<
  (typeof AUDIT_VOCABULARY)[A]['keys'][number],
  unknown
> &
  Record<string, unknown>;
