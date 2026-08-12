import type { PrismaClient } from "@prisma/client";

import { FinalActiveAdminError } from "./service";

import type {
  CellAdministrationRepository,
  CellAuditEventRecord,
  CellConfigurationRecord,
  LocalUserRecord,
  SupportedCurrency
} from "./service";

export class PrismaCellAdministrationRepository implements CellAdministrationRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async getConfiguration(): Promise<CellConfigurationRecord | undefined> {
    const configuration = await this.client.cellConfiguration.findUnique({ where: { id: "default" } });
    return configuration ? mapConfiguration(configuration) : undefined;
  }

  public async updateConfigurationWithAudit(configuration: CellConfigurationRecord, audit: CellAuditEventRecord): Promise<CellConfigurationRecord> {
    return this.client.$transaction(async (transaction) => {
      const stored = await transaction.cellConfiguration.upsert({
        where: { id: "default" },
        create: configurationData(configuration),
        update: configurationData(configuration)
      });
      await transaction.cellAuditEvent.create({ data: audit });
      return mapConfiguration(stored);
    });
  }

  public async getBusinessCurrency(): Promise<SupportedCurrency> {
    const settings = await this.client.businessSettings.findUnique({ where: { id: "default" }, select: { defaultCurrency: true } });
    return (settings?.defaultCurrency ?? "INR") as SupportedCurrency;
  }

  public async appendAuditEvent(event: CellAuditEventRecord): Promise<void> {
    await this.client.cellAuditEvent.create({ data: event });
  }

  public async auditEvents(): Promise<CellAuditEventRecord[]> {
    return (await this.client.cellAuditEvent.findMany({ orderBy: { occurredAt: "asc" } })).map((event) => ({
      ...event,
      result: event.result as CellAuditEventRecord["result"],
      error: event.error ?? undefined
    }));
  }

  public async listUsers(): Promise<LocalUserRecord[]> {
    return this.client.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: userSelection });
  }

  public async getUser(userId: string): Promise<LocalUserRecord | undefined> {
    return (await this.client.user.findUnique({ where: { id: userId }, select: userSelection })) ?? undefined;
  }

  public countActiveAdmins(): Promise<number> {
    return this.client.user.count({ where: { role: "ADMIN", active: true } });
  }

  public async createUserWithAudit(user: LocalUserRecord, passwordHash: string, audit: CellAuditEventRecord): Promise<LocalUserRecord> {
    return this.client.$transaction(async (transaction) => {
      const created = await transaction.user.create({ data: { ...user, passwordHash }, select: userSelection });
      await transaction.cellAuditEvent.create({ data: audit });
      return created;
    });
  }

  public async updateUserWithAudit(
    userId: string,
    update: Partial<Pick<LocalUserRecord, "name" | "role" | "active">>,
    audit: CellAuditEventRecord
  ): Promise<LocalUserRecord> {
    return this.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'ADMIN'::"UserRole" AND "active" = TRUE ORDER BY "id" FOR UPDATE`;
      const current = await transaction.user.findUnique({ where: { id: userId }, select: userSelection });
      if (!current) throw new Error("Local user was not found");
      const removesActiveAdmin = current.role === "ADMIN" && current.active
        && (update.active === false || update.role === "SALES");
      if (removesActiveAdmin) {
        const activeAdmins = await transaction.user.count({ where: { role: "ADMIN", active: true } });
        if (activeAdmins <= 1) throw new FinalActiveAdminError();
      }
      const updated = await transaction.user.update({ where: { id: userId }, data: update, select: userSelection });
      await transaction.cellAuditEvent.create({ data: audit });
      return updated;
    });
  }
}

const userSelection = { id: true, name: true, email: true, role: true, active: true } as const;

function configurationData(configuration: CellConfigurationRecord) {
  return {
    id: "default",
    displayName: configuration.displayName,
    logoUrl: configuration.logoUrl,
    primaryColor: configuration.primaryColor,
    locale: configuration.locale,
    timezone: configuration.timezone,
    defaultCurrency: configuration.defaultCurrency,
    enabledModules: configuration.enabledModules,
    allowedModules: configuration.allowedModules,
    planCode: configuration.planCode
  };
}

function mapConfiguration(configuration: {
  id: string; displayName: string; logoUrl: string | null; primaryColor: string; locale: string; timezone: string;
  defaultCurrency: string; enabledModules: string[]; allowedModules: string[]; planCode: string; createdAt: Date; updatedAt: Date;
}): CellConfigurationRecord {
  return {
    ...configuration,
    id: "default",
    defaultCurrency: configuration.defaultCurrency as SupportedCurrency
  };
}
