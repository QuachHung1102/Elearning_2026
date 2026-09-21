import { describe, expect, it } from "vitest";
import {
  auditApiQuery,
  auditEntity,
  auditEntityHref,
  auditFilters,
  type AuditLogRow,
} from "./audit";

const ADMIN_ID = "0b6f7a52-4a1d-4c4e-9f25-3d2a6b1c9e10";

describe("auditFilters", () => {
  it("keeps values the API accepts", () => {
    expect(
      auditFilters({
        actorId: ADMIN_ID,
        action: "enrollment.granted",
        entityType: "ENROLLMENT",
        from: "2026-09-01",
        to: ["2026-09-30", "2026-10-01"],
      }),
    ).toEqual({
      actorId: ADMIN_ID,
      action: "enrollment.granted",
      entityType: "ENROLLMENT",
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("drops anything the API would answer with a 400", () => {
    expect(
      auditFilters({
        actorId: "not-a-uuid",
        action: "enrollment.deleted",
        entityType: "Course",
        from: "2026-02-30",
        to: "yesterday",
      }),
    ).toEqual({ actorId: "", action: "", entityType: "", from: "", to: "" });
    // Well-formed but not version 4: the API's `@IsUUID('4')` refuses it.
    expect(
      auditFilters({ actorId: "00000000-0000-0000-0000-000000000001" }).actorId,
    ).toBe("");
    // Inherited keys are not part of the vocabulary.
    expect(auditFilters({ action: "toString" }).action).toBe("");
    // A half-typed year: strict ISO 8601 on the API refuses years below 1000.
    expect(auditFilters({ from: "0202-09-01", to: "0999-12-31" })).toMatchObject(
      { from: "", to: "" },
    );
    expect(auditFilters({ from: "1000-01-01" }).from).toBe("1000-01-01");
  });

  it("swaps a reversed date pair", () => {
    expect(
      auditFilters({ from: "2026-09-18", to: "2026-09-01" }),
    ).toMatchObject({ from: "2026-09-01", to: "2026-09-18" });
    expect(auditFilters({ from: "2026-09-18" })).toMatchObject({
      from: "2026-09-18",
      to: "",
    });
  });
});

describe("auditApiQuery", () => {
  it("turns picked days into whole days in Vietnam time", () => {
    const query = auditApiQuery(
      {
        actorId: "",
        action: "user.blocked",
        entityType: "",
        from: "2026-09-01",
        to: "2026-09-01",
      },
      "2",
    );
    const params = new URLSearchParams(query.slice(1));
    expect([...params.keys()]).toEqual(["action", "from", "to", "page"]);
    expect(new Date(params.get("from")!).toISOString()).toBe(
      "2026-08-31T17:00:00.000Z",
    );
    expect(new Date(params.get("to")!).toISOString()).toBe(
      "2026-09-01T16:59:59.999Z",
    );
  });

  it("sends nothing when nothing is filtered", () => {
    expect(
      auditApiQuery({ actorId: "", action: "", entityType: "", from: "", to: "" }),
    ).toBe("");
  });
});

describe("auditEntityHref", () => {
  const USER_ID = "5f0c2a9e-1b7d-4a3c-8e6f-2d9b0a4c7e11";
  const row = (patch: Partial<AuditLogRow>): AuditLogRow => ({
    id: "row",
    actorId: null,
    actorEmail: null,
    action: "user.blocked",
    entityType: "USER",
    entityId: USER_ID,
    metadata: null,
    ipAddress: null,
    createdAt: "2026-09-01T03:00:00.000Z",
    ...patch,
  });

  it("links a user row and an enrollment row to the affected user", () => {
    expect(auditEntityHref(row({}))).toBe(`/admin/users/${USER_ID}`);
    expect(
      auditEntityHref(
        row({
          action: "enrollment.granted",
          entityType: "ENROLLMENT",
          entityId: ADMIN_ID,
          metadata: { userId: USER_ID, courseId: ADMIN_ID },
        }),
      ),
    ).toBe(`/admin/users/${USER_ID}`);
  });

  it("links nothing it cannot name safely", () => {
    expect(auditEntityHref(row({ entityType: "COURSE" }))).toBeNull();
    expect(
      auditEntityHref(row({ entityType: "ENROLLMENT", metadata: {} })),
    ).toBeNull();
    expect(
      auditEntityHref(row({ entityType: "USER", entityId: "../../x" })),
    ).toBeNull();
  });
});

describe("auditEntity", () => {
  const row = (patch: Partial<AuditLogRow>): AuditLogRow => ({
    id: "row",
    actorId: null,
    actorEmail: null,
    action: "lesson.updated",
    entityType: "LESSON",
    entityId: "5f0c2a9e-1b7d-4a3c-8e6f-2d9b0a4c7e11",
    metadata: null,
    ipAddress: null,
    createdAt: "2026-09-01T03:00:00.000Z",
    ...patch,
  });

  it("names the entity from its metadata", () => {
    expect(auditEntity(row({ metadata: { title: "Cài đặt môi trường" } }))).toBe(
      "Bài học · Cài đặt môi trường",
    );
    expect(
      auditEntity(
        row({ entityType: "COURSE", metadata: { slug: "khoa-hoc-react" } }),
      ),
    ).toBe("Khóa học · khoa-hoc-react");
  });

  it("falls back to the start of the id, then to the type alone", () => {
    expect(auditEntity(row({ entityType: "USER", metadata: {} }))).toBe(
      "Người dùng · 5f0c2a9e",
    );
    expect(
      auditEntity(row({ entityType: "CATEGORY", entityId: null, metadata: {} })),
    ).toBe("Danh mục");
  });
});
