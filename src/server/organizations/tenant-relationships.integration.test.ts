import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  tenantOpaqueOwnedRelationships,
  tenantOwnedRelationships,
  tenantUserRelationships
} from "./tenant-relationships";
import { withOrganization } from "./with-organization";
import { validateDisposableDatabaseUrls } from "./disposable-database";

const ownerUrl = process.env.TEST_DATABASE_URL;
const tenantUrl = process.env.TEST_TENANT_DATABASE_URL;
const integration = describe.runIf(Boolean(ownerUrl && tenantUrl));

const organizations = {
  A: { id: "relation_org_A", userId: "relation_user_A" },
  B: { id: "relation_org_B", userId: "relation_user_B" }
} as const;

const excludedTenantModels = new Set([
  "OrganizationMembership",
  "OrganizationSettings",
  "OrganizationBranding"
]);
const tenantModels = Prisma.dmmf.datamodel.models.filter((model) =>
  model.fields.some((field) => field.name === "organizationId") && !excludedTenantModels.has(model.name)
);
const tenantModelNames = new Set(tenantModels.map((model) => model.name));

function quoted(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function insertionOrder() {
  const pending = new Set(tenantModelNames);
  const complete = new Set<string>();
  const result: typeof tenantModels = [];
  while (pending.size > 0) {
    const ready = tenantModels.filter((model) => pending.has(model.name) && tenantOwnedRelationships
      .filter((relation) => relation.child === model.name && relation.parent !== model.name)
      .every((relation) => complete.has(relation.parent)));
    if (ready.length === 0) throw new Error(`Tenant relationship cycle: ${[...pending].join(", ")}`);
    for (const model of ready) {
      result.push(model);
      pending.delete(model.name);
      complete.add(model.name);
    }
  }
  return result;
}

function scalarValue(modelName: string, fieldName: string, fieldType: string, suffix: "A" | "B") {
  switch (fieldType) {
    case "String": return `same_${modelName}_${fieldName}`;
    case "Int": return 1;
    case "BigInt": return BigInt(1);
    case "Float":
    case "Decimal": return 1;
    case "Boolean": return true;
    case "DateTime": return new Date("2026-08-09T00:00:00.000Z");
    case "Json": return JSON.stringify({ shape: "same" });
    case "Bytes": return Buffer.from(`same-${suffix}`);
    default: {
      const enumType = Prisma.dmmf.datamodel.enums.find((item) => item.name === fieldType);
      if (enumType?.values[0]) return enumType.values[0].name;
      throw new Error(`No synthetic value for ${modelName}.${fieldName}: ${fieldType}`);
    }
  }
}

integration("complete tenant relationship enforcement", () => {
  if (!ownerUrl || !tenantUrl) return;
  const safeUrls = validateDisposableDatabaseUrls(ownerUrl, tenantUrl);
  const ownerDatabase = new PrismaClient({ datasourceUrl: safeUrls.ownerUrl });
  const tenantDatabase = new PrismaClient({ datasourceUrl: safeUrls.tenantUrl });
  const order = insertionOrder();
  const ids = new Map<string, string>();

  function fixtureId(modelName: string, suffix: "A" | "B") {
    return `relation_${modelName}_${suffix}`;
  }

  async function deleteFixtures() {
    for (const model of [...order].reverse()) {
      const table = model.dbName ?? model.name;
      await ownerDatabase.$executeRawUnsafe(
        `DELETE FROM ${quoted(table)} WHERE "organizationId" IN ($1, $2)`,
        organizations.A.id,
        organizations.B.id
      );
    }
    await ownerDatabase.organizationMembership.deleteMany({
      where: { organizationId: { in: [organizations.A.id, organizations.B.id] } }
    });
    await ownerDatabase.user.deleteMany({
      where: { id: { in: [organizations.A.userId, organizations.B.userId] } }
    });
    await ownerDatabase.organization.deleteMany({
      where: { id: { in: [organizations.A.id, organizations.B.id] } }
    });
  }

  beforeAll(async () => {
    await deleteFixtures();
    await ownerDatabase.organization.createMany({ data: [
      { id: organizations.A.id, key: "relation-org-a", legalName: "Relation A", displayName: "Same Shape", deploymentRegion: "local", status: "ACTIVE" },
      { id: organizations.B.id, key: "relation-org-b", legalName: "Relation B", displayName: "Same Shape", deploymentRegion: "local", status: "ACTIVE" }
    ] });
    await ownerDatabase.user.createMany({ data: [
      { id: organizations.A.userId, name: "Same User", email: "relation-a@example.test", passwordHash: "test", role: "SALES", active: true },
      { id: organizations.B.userId, name: "Same User", email: "relation-b@example.test", passwordHash: "test", role: "SALES", active: true }
    ] });
    await ownerDatabase.organizationMembership.createMany({ data: [
      { id: "relation_membership_A", organizationId: organizations.A.id, userId: organizations.A.userId, role: "SALES", status: "ACTIVE" },
      { id: "relation_membership_B", organizationId: organizations.B.id, userId: organizations.B.userId, role: "SALES", status: "ACTIVE" }
    ] });

    for (const suffix of ["A", "B"] as const) {
      const organization = organizations[suffix];
      await ownerDatabase.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.organization_id', ${organization.id}, true)`;
        for (const model of order) {
          const table = model.dbName ?? model.name;
          const modelId = model.fields.some((field) => field.name === "id") ? fixtureId(model.name, suffix) : undefined;
          if (modelId) ids.set(`${suffix}:${model.name}`, modelId);
          const values = new Map<string, { type: string; value: unknown }>();
          for (const field of model.fields.filter((item) => item.kind !== "object")) {
            if (field.name === "organizationId") {
              values.set(field.dbName ?? field.name, { type: field.type, value: organization.id });
              continue;
            }
            if (field.name === "id" && modelId) {
              values.set(field.dbName ?? field.name, { type: field.type, value: modelId });
              continue;
            }
            const ownedRelation = tenantOwnedRelationships.find((relation) =>
              relation.child === model.name && relation.childField === field.name
            ) ?? tenantOpaqueOwnedRelationships.find((relation) =>
              relation.child === model.name && relation.childField === field.name
            );
            if (ownedRelation) {
              const parentId = ownedRelation.parent === model.name
                ? modelId
                : ids.get(`${suffix}:${ownedRelation.parent}`);
              if (!parentId) throw new Error(`Missing ${suffix} fixture for ${ownedRelation.parent}`);
              values.set(field.dbName ?? field.name, { type: field.type, value: parentId });
              continue;
            }
            if (tenantUserRelationships.some((relation) =>
              relation.child === model.name && relation.childField === field.name
            )) {
              values.set(field.dbName ?? field.name, { type: field.type, value: organization.userId });
              continue;
            }
            if (!field.isRequired || field.hasDefaultValue) continue;
            values.set(field.dbName ?? field.name, {
              type: field.type,
              value: scalarValue(model.name, field.name, field.type, suffix)
            });
          }

          const columns = [...values.keys()];
          const entries = [...values.values()];
          const placeholders = entries.map((entry, index) => {
            const enumType = Prisma.dmmf.datamodel.enums.find((item) => item.name === entry.type);
            const cast = entry.type === "Json"
              ? "::jsonb"
              : enumType
                ? `::${quoted(enumType.dbName ?? enumType.name)}`
                : "";
            return `$${index + 1}${cast}`;
          });
          await transaction.$executeRawUnsafe(
            `INSERT INTO ${quoted(table)} (${columns.map(quoted).join(", ")}) VALUES (${placeholders.join(", ")})`,
            ...entries.map((entry) => entry.value)
          );
        }
      });
    }
  });

  afterAll(async () => {
    await deleteFixtures();
    await tenantDatabase.$disconnect();
    await ownerDatabase.$disconnect();
  });

  it("rejects every A-child to B-parent attachment through the actual tenant login", async () => {
    const relationships = [...tenantOwnedRelationships, ...tenantOpaqueOwnedRelationships];
    await withOrganization(organizations.A.id, async (transaction) => {
      for (const [index, relation] of relationships.entries()) {
        const savepoint = `owned_relation_${index}`;
        await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        await expect(transaction.$executeRawUnsafe(
          `UPDATE ${quoted(relation.child)} SET ${quoted(relation.childField)} = $1 WHERE "organizationId" = $2`,
          ids.get(`B:${relation.parent}`),
          organizations.A.id
        ), `${relation.child}.${relation.childField} must reject a tenant-B parent`).rejects.toThrow();
        await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
    }, tenantDatabase);
    expect(relationships).toHaveLength(59);
  });

  it("rejects every A-row to B-user attachment through transactional membership triggers", async () => {
    await withOrganization(organizations.A.id, async (transaction) => {
      for (const [index, relation] of tenantUserRelationships.entries()) {
        const savepoint = `user_relation_${index}`;
        await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
        await expect(transaction.$executeRawUnsafe(
          `UPDATE ${quoted(relation.child)} SET ${quoted(relation.childField)} = $1 WHERE "organizationId" = $2`,
          organizations.B.userId,
          organizations.A.id
        ), `${relation.child}.${relation.childField} must reject a tenant-B user`).rejects.toThrow("Tenant member was not found.");
        await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
    }, tenantDatabase);
    expect(tenantUserRelationships).toHaveLength(48);
  });
});
