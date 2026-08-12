import { randomUUID } from "node:crypto";

import { hashPassword } from "@/server/auth/password";

export type CellAdminActor = { id: string; role: "ADMIN" | "SALES" };
export type SupportedCurrency = "INR" | "USD";

export type CellConfigurationRecord = {
  id: "default";
  displayName: string;
  logoUrl: string | null;
  primaryColor: string;
  locale: string;
  timezone: string;
  defaultCurrency: SupportedCurrency;
  enabledModules: string[];
  allowedModules: string[];
  planCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LocalUserRecord = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SALES";
  active: boolean;
};

export type CellAuditEventRecord = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  reason: string;
  result: "SUCCEEDED" | "FAILED";
  error?: string;
  occurredAt: Date;
};

export class FinalActiveAdminError extends Error {
  public constructor() {
    super("The final active Admin cannot be deactivated or changed to Sales");
    this.name = "FinalActiveAdminError";
  }
}

export interface CellAdministrationRepository {
  getConfiguration(): Promise<CellConfigurationRecord | undefined>;
  updateConfigurationWithAudit(configuration: CellConfigurationRecord, audit: CellAuditEventRecord): Promise<CellConfigurationRecord>;
  getBusinessCurrency(): Promise<SupportedCurrency>;
  appendAuditEvent(event: CellAuditEventRecord): Promise<void>;
  auditEvents(): Promise<CellAuditEventRecord[]>;
  listUsers(): Promise<LocalUserRecord[]>;
  getUser(userId: string): Promise<LocalUserRecord | undefined>;
  countActiveAdmins(): Promise<number>;
  createUserWithAudit(user: LocalUserRecord, passwordHash: string, audit: CellAuditEventRecord): Promise<LocalUserRecord>;
  updateUserWithAudit(userId: string, update: Partial<Pick<LocalUserRecord, "name" | "role" | "active">>, audit: CellAuditEventRecord): Promise<LocalUserRecord>;
}

export class CellAdministrationService {
  public constructor(
    private readonly repository: CellAdministrationRepository,
    private readonly hash: (password: string) => Promise<string> = hashPassword,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async getConfiguration(user: CellAdminActor): Promise<CellConfigurationRecord> {
    this.assertKnownRole(user);
    const existing = await this.repository.getConfiguration();
    if (existing) return existing;
    const now = this.now();
    return {
      id: "default",
      displayName: "eCRM",
      logoUrl: null,
      primaryColor: "#1e3a5f",
      locale: "en-US",
      timezone: "UTC",
      defaultCurrency: await this.repository.getBusinessCurrency(),
      enabledModules: [],
      allowedModules: [],
      planCode: "UNASSIGNED",
      createdAt: now,
      updatedAt: now
    };
  }

  public async updateConfiguration(
    user: CellAdminActor,
    update: Partial<Pick<CellConfigurationRecord, "displayName" | "logoUrl" | "primaryColor" | "locale" | "timezone" | "defaultCurrency" | "enabledModules">>,
    context: { correlationId: string; reason: string }
  ): Promise<CellConfigurationRecord> {
    const action = "cell-configuration.update";
    if (user.role !== "ADMIN") return this.reject(user, action, "default", context, "ADMIN_REQUIRED", "Only Admin can manage customer-cell administration");
    const existing = await this.getConfiguration(user);
    const excluded = update.enabledModules?.find((module) => !existing.allowedModules.includes(module));
    if (excluded) return this.reject(user, action, "default", context, "PLAN_MODULE_EXCLUDED", `Module ${excluded} is not included in this plan`);
    const configuration: CellConfigurationRecord = {
      ...existing,
      ...update,
      displayName: update.displayName?.trim() || existing.displayName || "eCRM",
      logoUrl: update.logoUrl?.trim() || null,
      allowedModules: existing.allowedModules,
      planCode: existing.planCode,
      updatedAt: this.now()
    };
    return this.repository.updateConfigurationWithAudit(configuration, this.audit(user, action, "CellConfiguration", "default", context, "SUCCEEDED"));
  }

  public listUsers(user: CellAdminActor): Promise<LocalUserRecord[]> {
    if (user.role !== "ADMIN") throw new Error("Only Admin can manage customer-cell administration");
    return this.repository.listUsers();
  }

  public async createUser(
    user: CellAdminActor,
    input: { name: string; email: string; password: string; role: "ADMIN" | "SALES" },
    context: { correlationId: string; reason: string }
  ): Promise<LocalUserRecord> {
    const action = "local-user.create";
    if (user.role !== "ADMIN") return this.reject(user, action, input.email, context, "ADMIN_REQUIRED", "Only Admin can manage customer-cell administration");
    if (input.password.length < 12) return this.reject(user, action, input.email, context, "WEAK_PASSWORD", "Password must be at least 12 characters");
    const record: LocalUserRecord = {
      id: `user_${randomUUID()}`,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      active: true
    };
    return this.repository.createUserWithAudit(record, await this.hash(input.password), this.audit(user, action, "User", record.id, context, "SUCCEEDED"));
  }

  public async updateUser(
    user: CellAdminActor,
    userId: string,
    update: Partial<Pick<LocalUserRecord, "name" | "role" | "active">>,
    context: { correlationId: string; reason: string }
  ): Promise<LocalUserRecord> {
    const action = "local-user.update";
    if (user.role !== "ADMIN") return this.reject(user, action, userId, context, "ADMIN_REQUIRED", "Only Admin can manage customer-cell administration");
    const target = await this.repository.getUser(userId);
    if (!target) return this.reject(user, action, userId, context, "USER_NOT_FOUND", "Local user was not found");
    try {
      return await this.repository.updateUserWithAudit(userId, update, this.audit(user, action, "User", userId, context, "SUCCEEDED"));
    } catch (error) {
      if (error instanceof FinalActiveAdminError) {
        return this.reject(user, action, userId, context, "FINAL_ACTIVE_ADMIN", error.message);
      }
      throw error;
    }
  }

  private assertKnownRole(user: CellAdminActor) {
    if (user.role !== "ADMIN" && user.role !== "SALES") throw new Error("Unknown local role");
  }

  private async reject<T>(
    user: CellAdminActor,
    action: string,
    targetId: string,
    context: { correlationId: string; reason: string },
    error: string,
    message: string
  ): Promise<T> {
    await this.repository.appendAuditEvent(this.audit(user, action, action.startsWith("local-user") ? "User" : "CellConfiguration", targetId, context, "FAILED", error));
    throw new Error(message);
  }

  private audit(
    user: CellAdminActor,
    action: string,
    targetType: string,
    targetId: string,
    context: { correlationId: string; reason: string },
    result: "SUCCEEDED" | "FAILED",
    error?: string
  ): CellAuditEventRecord {
    return {
      id: `audit_${randomUUID()}`,
      actorId: user.id,
      action,
      targetType,
      targetId,
      correlationId: context.correlationId,
      reason: context.reason,
      result,
      error,
      occurredAt: this.now()
    };
  }
}

export interface InMemoryCellAdministrationRepository extends CellAdministrationRepository {
  passwordHashFor(userId: string): string | undefined;
}

export function createInMemoryCellAdministrationRepository(options: {
  configuration?: CellConfigurationRecord;
  allowedModules?: string[];
  users?: LocalUserRecord[];
} = {}): InMemoryCellAdministrationRepository {
  let configuration = options.configuration
    ? { ...options.configuration, enabledModules: [...options.configuration.enabledModules], allowedModules: [...options.configuration.allowedModules] }
    : undefined;
  const allowedModules = options.allowedModules ?? [];
  const users = new Map((options.users ?? []).map((user) => [user.id, { ...user }]));
  const passwordHashes = new Map<string, string>();
  const audits: CellAuditEventRecord[] = [];
  const businessCurrency: SupportedCurrency = configuration?.defaultCurrency ?? "INR";
  let userUpdateQueue = Promise.resolve();

  return {
    getConfiguration: async () => configuration
      ? { ...configuration, enabledModules: [...configuration.enabledModules], allowedModules: [...configuration.allowedModules] }
      : allowedModules.length
        ? {
            id: "default", displayName: "eCRM", logoUrl: null, primaryColor: "#1e3a5f", locale: "en-US", timezone: "UTC",
            defaultCurrency: businessCurrency, enabledModules: [], allowedModules: [...allowedModules], planCode: "UNASSIGNED",
            createdAt: new Date(), updatedAt: new Date()
          }
        : undefined,
    updateConfigurationWithAudit: async (next, audit) => {
      configuration = { ...next, enabledModules: [...next.enabledModules], allowedModules: [...next.allowedModules] };
      audits.push({ ...audit });
      return { ...configuration, enabledModules: [...configuration.enabledModules], allowedModules: [...configuration.allowedModules] };
    },
    getBusinessCurrency: async () => businessCurrency,
    appendAuditEvent: async (event) => { audits.push({ ...event }); },
    auditEvents: async () => audits.map((event) => ({ ...event })),
    listUsers: async () => [...users.values()].map((entry) => ({ ...entry })),
    getUser: async (userId) => {
      const found = users.get(userId);
      return found ? { ...found } : undefined;
    },
    countActiveAdmins: async () => [...users.values()].filter((entry) => entry.active && entry.role === "ADMIN").length,
    createUserWithAudit: async (newUser, passwordHash, audit) => {
      if ([...users.values()].some((entry) => entry.email === newUser.email)) throw new Error("A local user with this email already exists");
      users.set(newUser.id, { ...newUser });
      passwordHashes.set(newUser.id, passwordHash);
      audits.push({ ...audit });
      return { ...newUser };
    },
    updateUserWithAudit: async (userId, update, audit) => {
      const execute = async () => {
        const current = users.get(userId);
        if (!current) throw new Error("Local user was not found");
        const removesActiveAdmin = current.role === "ADMIN" && current.active
          && (update.active === false || update.role === "SALES");
        const activeAdmins = [...users.values()].filter((entry) => entry.active && entry.role === "ADMIN").length;
        if (removesActiveAdmin && activeAdmins <= 1) throw new FinalActiveAdminError();
        const updated = { ...current, ...update };
        users.set(userId, updated);
        audits.push({ ...audit });
        return { ...updated };
      };
      const result = userUpdateQueue.then(execute, execute);
      userUpdateQueue = result.then(() => undefined, () => undefined);
      return result;
    },
    passwordHashFor: (userId) => passwordHashes.get(userId)
  };
}
