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
  cellControlProjection: { findUnique(args: { where: { cellId: string }; select?: { cellId: true } }): Promise<{ cellId: string } | null> };
  cellConfiguration: { upsert(args: { where: { id: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown> };
  user: {
    findUnique(args: { where: { email: string } }): Promise<{ id: string; name: string; email: string; passwordHash: string; role: string; active: boolean } | null>;
    upsert(args: { where: { email: string }; update: Record<string, unknown>; create: Record<string, unknown> }): Promise<unknown>;
  };
};

export async function seedTenant(client: TenantSeedClient, fixture: TenantSeedFixture, secrets: TenantSeedSecrets = {}): Promise<void> {
  const projection = await client.cellControlProjection.findUnique({ where: { cellId: fixture.cellId }, select: { cellId: true } });
  if (!projection || projection.cellId !== fixture.cellId) throw new Error("Persisted cell identity does not match CELL_ID");

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

  for (const user of fixture.users) {
    const existing = existingUsers.get(user.email);
    const password = user.role === "ADMIN" ? secrets.adminPassword : secrets.salesPassword;
    await client.user.upsert({
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
