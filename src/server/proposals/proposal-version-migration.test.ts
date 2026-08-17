import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "prisma/migrations/20260816160000_add_tenant_proposal_versions/migration.sql"),
  "utf8"
);

describe("tenant proposal version migration", () => {
  it("binds proposal history to organization, proposal, and client composite identities", () => {
    expect(migration).toContain('FOREIGN KEY ("organizationId", "proposalId")');
    expect(migration).toContain('FOREIGN KEY ("organizationId", "clientAccountId")');
    expect(migration).toContain('FOREIGN KEY ("organizationId", "versionId")');
  });

  it("makes proposal versions and their lines append-only", () => {
    expect(migration).toContain('CREATE TRIGGER "ProposalVersion_immutable"');
    expect(migration).toContain('CREATE TRIGGER "ProposalVersionLine_immutable"');
    expect(migration).toMatch(/IF TG_OP IN \('UPDATE', 'DELETE'\).*proposal version history is immutable/is);
  });
});
