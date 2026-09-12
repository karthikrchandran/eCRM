import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { tenantSeedFixtures, type TenantSeedFixture, type TenantSeedKey } from "./tenant-seed-fixtures";

export type TenantSeedEnvironment = {
  appMode: "cell";
  cellId: string;
  cellKey: TenantSeedKey;
  databaseUrl: string;
  tenantSeed: TenantSeedKey;
};

export type TenantSeedSecrets = {
  adminPassword?: string;
  salesPassword?: string;
};

export function validateTenantSeedEnvironment(input: Record<string, string | undefined>): TenantSeedEnvironment {
  if (input.APP_MODE !== "cell") throw new Error("APP_MODE must be cell for tenant seeding");
  const tenantSeed = input.TENANT_SEED;
  if (!tenantSeed || !(tenantSeed in tenantSeedFixtures)) throw new Error("TENANT_SEED must be ara-global or ai-consulting");
  const cellId = input.CELL_ID?.trim();
  if (!cellId) throw new Error("CELL_ID is required for tenant seeding");
  const fixture = tenantSeedFixtures[tenantSeed as TenantSeedKey];
  if (cellId !== fixture.cellId) throw new Error("CELL_ID must match TENANT_SEED fixture");
  const cellKey = input.CELL_KEY;
  if (!cellKey || !/^[a-z0-9-]+$/.test(cellKey)) throw new Error("CELL_KEY is required and must match ^[a-z0-9-]+$");
  if (cellKey !== tenantSeed) throw new Error("CELL_KEY must match TENANT_SEED");
  const databaseUrl = input.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required for tenant seeding");
  return { appMode: "cell", cellId, cellKey: tenantSeed as TenantSeedKey, databaseUrl, tenantSeed: tenantSeed as TenantSeedKey };
}

type TenantSeedClient = {
  cellControlProjection: {
    findUnique(args: { where: { cellId: string }; select?: { cellId: true } }): Promise<{ cellId: string } | null>;
    create(args: { data: { cellId: string; lifecycleStatus: string; version: number; appliedAt: Date; sourceEventId: string; sourceIdempotencyKey: string } }): Promise<{ cellId: string }>;
  };
  cellConfiguration: { upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown> };
  user: {
    findUnique(args: { where: { email: string } }): Promise<{ id: string; name: string; email: string; passwordHash: string; role: string; active: boolean } | null>;
    upsert(args: { where: { email: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<{ id: string; name: string; email: string; passwordHash: string; role: string; active: boolean }>;
  };
  leadCustomer: {
    upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<{ id: string }>;
  };
  branch: {
    upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  contact: {
    upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  activity: {
    upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
  salesTarget: {
    upsert(args: {
      where: { ownerId_financialYear_quarter: { ownerId: string; financialYear: number; quarter: number } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
};

export async function seedTenant(client: TenantSeedClient, fixture: TenantSeedFixture, secrets: TenantSeedSecrets = {}): Promise<void> {
  const projection = await client.cellControlProjection.findUnique({ where: { cellId: fixture.cellId }, select: { cellId: true } });
  if (projection && projection.cellId !== fixture.cellId) throw new Error("Persisted cell identity does not match CELL_ID");
  if (!projection) {
    await client.cellControlProjection.create({
      data: {
        cellId: fixture.cellId,
        lifecycleStatus: "ACTIVE",
        version: 1,
        appliedAt: new Date(),
        sourceEventId: `tenant-seed:${fixture.cellKey}:bootstrap`,
        sourceIdempotencyKey: `tenant-seed:${fixture.cellKey}:bootstrap:v1`
      }
    });
  }

  const existingUsers = new Map<string, Awaited<ReturnType<TenantSeedClient["user"]["findUnique"]>>>();
  for (const user of fixture.users) {
    existingUsers.set(user.email, await client.user.findUnique({ where: { email: user.email } }));
  }
  for (const user of fixture.users) {
    if (existingUsers.get(user.email)) continue;
    const password = user.role === "ADMIN" ? secrets.adminPassword : secrets.salesPassword;
    if (!password?.trim()) {
      throw new Error(`TENANT_SEED_${user.role === "ADMIN" ? "ADMIN" : "SALES"}_PASSWORD is required to create ${user.email}`);
    }
  }

  await client.cellConfiguration.upsert({
    where: { id: "default" },
    update: {
      displayName: fixture.displayName,
      enabledModules: [...fixture.enabledModules],
      allowedModules: [...fixture.allowedModules],
      planCode: fixture.planCode
    },
    create: {
      id: "default",
      displayName: fixture.displayName,
      enabledModules: [...fixture.enabledModules],
      allowedModules: [...fixture.allowedModules],
      planCode: fixture.planCode
    }
  });

  const usersByEmail = new Map<string, { id: string; name: string; email: string; passwordHash: string; role: string; active: boolean }>();
  for (const user of fixture.users) {
    const existing = existingUsers.get(user.email);
    const password = user.role === "ADMIN" ? secrets.adminPassword : secrets.salesPassword;
    const persisted = await client.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: existing ? existing.passwordHash : await bcrypt.hash(password as string, 12),
        role: user.role,
        active: true
      }
    });
    usersByEmail.set(user.email, persisted);
  }

  const adminUser = fixture.users.find((user) => user.role === "ADMIN");
  if (!adminUser) throw new Error("Tenant fixture must include an admin user");
  const admin = usersByEmail.get(adminUser.email);
  if (!admin) throw new Error("Tenant admin was not persisted");

  for (const lead of fixture.demoLeadCustomers) {
    const owner = usersByEmail.get(lead.ownerEmail);
    if (!owner) throw new Error(`Demo lead owner ${lead.ownerEmail} was not seeded`);

    const leadCustomer = await client.leadCustomer.upsert({
      where: { id: lead.id },
      update: {
        name: lead.name,
        state: lead.state,
        industry: lead.industry,
        source: lead.source,
        ownerId: owner.id,
        notes: lead.notes,
        updatedById: admin.id
      },
      create: {
        id: lead.id,
        name: lead.name,
        state: lead.state,
        industry: lead.industry,
        source: lead.source,
        ownerId: owner.id,
        notes: lead.notes,
        createdById: admin.id,
        updatedById: admin.id
      }
    });

    await client.branch.upsert({
      where: { id: lead.branch.id },
      update: {
        leadCustomerId: leadCustomer.id,
        name: lead.branch.name,
        city: lead.branch.city,
        region: lead.branch.region,
        country: "India",
        salesContext: lead.branch.salesContext
      },
      create: {
        id: lead.branch.id,
        leadCustomerId: leadCustomer.id,
        name: lead.branch.name,
        city: lead.branch.city,
        region: lead.branch.region,
        country: "India",
        salesContext: lead.branch.salesContext
      }
    });

    await client.contact.upsert({
      where: { id: lead.contact.id },
      update: {
        leadCustomerId: leadCustomer.id,
        branchId: lead.branch.id,
        name: lead.contact.name,
        designation: lead.contact.designation,
        email: lead.contact.email,
        phone: lead.contact.phone,
        isPrimary: true
      },
      create: {
        id: lead.contact.id,
        leadCustomerId: leadCustomer.id,
        branchId: lead.branch.id,
        name: lead.contact.name,
        designation: lead.contact.designation,
        email: lead.contact.email,
        phone: lead.contact.phone,
        isPrimary: true
      }
    });

    await client.activity.upsert({
      where: { id: lead.activity.id },
      update: {
        leadCustomerId: leadCustomer.id,
        branchId: lead.branch.id,
        contactId: lead.contact.id,
        ownerId: owner.id,
        type: lead.activity.type,
        status: "OPEN",
        subject: lead.activity.subject,
        dueAt: new Date(lead.activity.dueAt)
      },
      create: {
        id: lead.activity.id,
        leadCustomerId: leadCustomer.id,
        branchId: lead.branch.id,
        contactId: lead.contact.id,
        ownerId: owner.id,
        createdById: admin.id,
        type: lead.activity.type,
        status: "OPEN",
        subject: lead.activity.subject,
        dueAt: new Date(lead.activity.dueAt)
      }
    });

    await client.salesTarget.upsert({
      where: {
        ownerId_financialYear_quarter: {
          ownerId: owner.id,
          financialYear: lead.salesTarget.financialYear,
          quarter: lead.salesTarget.quarter
        }
      },
      update: {
        targetValueInr: lead.salesTarget.targetValueInr
      },
      create: {
        ownerId: owner.id,
        financialYear: lead.salesTarget.financialYear,
        quarter: lead.salesTarget.quarter,
        targetValueInr: lead.salesTarget.targetValueInr,
        createdById: admin.id
      }
    });
  }
}

export async function runTenantSeed(input: Record<string, string | undefined> = process.env): Promise<void> {
  const environment = validateTenantSeedEnvironment(input);
  const fixture = tenantSeedFixtures[environment.tenantSeed];
  const client = new PrismaClient({ datasources: { db: { url: environment.databaseUrl } } });
  try {
    await seedTenant(client as unknown as TenantSeedClient, fixture, {
      adminPassword: input.TENANT_SEED_ADMIN_PASSWORD,
      salesPassword: input.TENANT_SEED_SALES_PASSWORD
    });
    console.log(`Seeded ${fixture.displayName} (${environment.cellId}) users and configuration.`);
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/tenant-seed.ts")) {
  runTenantSeed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
