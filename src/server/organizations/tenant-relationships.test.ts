import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tenantOpaqueOwnedRelationships, tenantOwnedRelationships, tenantUserRelationships } from "./tenant-relationships";

const tenantModels = new Set(Prisma.dmmf.datamodel.models
  .filter((model) => model.fields.some((field) => field.name === "organizationId"))
  .map((model) => model.name)
  .filter((name) => !["OrganizationMembership", "OrganizationSettings", "OrganizationBranding"].includes(name)));

const expected = Prisma.dmmf.datamodel.models.flatMap((model) =>
  tenantModels.has(model.name)
    ? model.fields
      .filter((field) => field.kind === "object" && field.relationFromFields?.length && tenantModels.has(field.type))
      .map((field) => `${model.name}.${field.relationFromFields!.join(",")}->${field.type}.${field.relationToFields!.join(",")}`)
    : []
).sort();

const expectedUserRelationships = Prisma.dmmf.datamodel.models.flatMap((model) =>
  tenantModels.has(model.name)
    ? model.fields
      .filter((field) => field.kind === "object" && field.type === "User" && field.relationFromFields?.length)
      .flatMap((field) => field.relationFromFields!.map((childField) => `${model.name}.${childField}->User.id`))
    : []
).sort();

describe("tenant-owned relationship inventory", () => {
  it("enumerates every owned parent relation exactly once", () => {
    const actual = tenantOwnedRelationships.map(({ child, childField, parent, parentField }) =>
      `${child}.${childField}->${parent}.${parentField}`).sort();
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(expected.length);
  });

  it("tracks the validated shared-record parent relationship omitted from Prisma relations", () => {
    expect(tenantOpaqueOwnedRelationships).toEqual([
      { child: "SharedBusinessRecord", childField: "parentId", parent: "SharedBusinessRecord", parentField: "id" }
    ]);
  });

  it("enumerates every owned-model User foreign key for active membership enforcement", () => {
    const actual = tenantUserRelationships
      .map(({ child, childField }) => `${child}.${childField}->User.id`)
      .sort();

    expect(actual).toEqual(expectedUserRelationships);
    expect(actual).toHaveLength(48);
    expect(new Set(actual).size).toBe(expectedUserRelationships.length);
  });

  it("installs a fixed-search-path transactional membership trigger for every User foreign key", () => {
    const migration = readFileSync(path.join(
      process.cwd(),
      "prisma/migrations/20260809120049_complete_user_membership_guards/migration.sql"
    ), "utf8");
    const executable = migration.replace(/--.*$/gm, "");

    expect(executable).toContain("SECURITY DEFINER");
    expect(executable).toContain("SET search_path = pg_catalog, public");
    expect(executable).toContain("FOR SHARE OF account, membership, organization");
    expect(executable).toContain("ERRCODE = '23503'");
    for (const { child, childField } of tenantUserRelationships) {
      expect(executable).toContain(`('${child}','${childField}')`);
    }
  });
});
