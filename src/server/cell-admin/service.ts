import { randomUUID } from "node:crypto";

import { hashPassword } from "@/server/auth/password";

export type CellAdminActor = { id: string; role: "ADMIN" | "SALES" };
export type SupportedCurrency = "INR" | "USD";
export type CellAuditSnapshot = Record<string, string | string[] | boolean | number | null>;

export type CellConfigurationRecord = {
  id: "default";
  displayName: string;
  logoUrl: string | null;
  supportUrl: string | null;
  legalUrl: string | null;
  primaryColor: string;
  locale: string;
  timezone: string;
  defaultCurrency: SupportedCurrency;
  enabledModules: string[];
  allowedModules: string[];
  planCode: string;
  revision: number;
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
  before?: CellAuditSnapshot | null;
  after?: CellAuditSnapshot | null;
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

export class ConfigurationConflictError extends Error {
  public constructor() {
    super("Cell configuration changed. Refresh and try again");
    this.name = "ConfigurationConflictError";
  }
}

export interface CellAdministrationRepository {
  getConfiguration(): Promise<CellConfigurationRecord | undefined>;
  updateConfigurationWithAudit(configuration: CellConfigurationRecord, expectedRevision: number, audit: CellAuditEventRecord): Promise<CellConfigurationRecord | undefined>;
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
      supportUrl: null,
      legalUrl: null,
      primaryColor: "#1e3a5f",
      locale: "en-US",
      timezone: "UTC",
      defaultCurrency: await this.repository.getBusinessCurrency(),
      enabledModules: [],
      allowedModules: [],
      planCode: "UNASSIGNED",
      revision: 0,
      createdAt: now,
      updatedAt: now
    };
  }

  public async updateConfiguration(
    user: CellAdminActor,
    update: Partial<Pick<CellConfigurationRecord, "displayName" | "logoUrl" | "supportUrl" | "legalUrl" | "primaryColor" | "locale" | "timezone" | "defaultCurrency" | "enabledModules">>,
    context: { correlationId: string; reason: string; expectedRevision?: number }
  ): Promise<CellConfigurationRecord> {
    const action = "cell-configuration.update";
    if (user.role !== "ADMIN") return this.reject(user, action, "default", context, "ADMIN_REQUIRED", "Only Admin can manage customer-cell administration");
    const existing = await this.getConfiguration(user);
    const expectedRevision = context.expectedRevision ?? existing.revision;
    if (expectedRevision !== existing.revision) {
      return this.reject(user, action, "default", context, "CONFIGURATION_CONFLICT", "Cell configuration changed. Refresh and try again", configurationAuditSnapshot(existing));
    }
    if (!safePublicHttps(update.supportUrl) || !safePublicHttps(update.legalUrl)) {
      return this.reject(user, action, "default", context, "UNSAFE_EXTERNAL_URL", "Support and legal URLs must use public HTTPS", configurationAuditSnapshot(existing));
    }
    const excluded = update.enabledModules?.find((module) => !existing.allowedModules.includes(module));
    if (excluded) return this.reject(
      user,
      action,
      "default",
      context,
      "PLAN_MODULE_EXCLUDED",
      `Module ${excluded} is not included in this plan`,
      configurationAuditSnapshot(existing),
      configurationAuditSnapshot({ ...existing, ...update })
    );
    const configuration: CellConfigurationRecord = {
      ...existing,
      ...update,
      displayName: update.displayName?.trim() || existing.displayName || "eCRM",
      logoUrl: update.logoUrl === undefined ? existing.logoUrl : update.logoUrl?.trim() || null,
      supportUrl: update.supportUrl === undefined ? existing.supportUrl : update.supportUrl?.trim() || null,
      legalUrl: update.legalUrl === undefined ? existing.legalUrl : update.legalUrl?.trim() || null,
      allowedModules: existing.allowedModules,
      planCode: existing.planCode,
      revision: existing.revision + 1,
      updatedAt: this.now()
    };
    const stored = await this.repository.updateConfigurationWithAudit(
      configuration,
      expectedRevision,
      this.audit(
        user,
        action,
        "CellConfiguration",
        "default",
        context,
        "SUCCEEDED",
        undefined,
        configurationAuditSnapshot(existing),
        configurationAuditSnapshot(configuration)
      )
    );
    if (stored) return stored;
    const current = await this.getConfiguration(user);
    await this.repository.appendAuditEvent(this.audit(
      user, action, "CellConfiguration", "default", context, "FAILED", "CONFIGURATION_CONFLICT",
      configurationAuditSnapshot(current), configurationAuditSnapshot(configuration)
    ));
    throw new ConfigurationConflictError();
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
    try {
      return await this.repository.createUserWithAudit(
        record,
        await this.hash(input.password),
        this.audit(user, action, "User", record.id, context, "SUCCEEDED", undefined, null, userAuditSnapshot(record))
      );
    } catch (error) {
      if (isDuplicateEmail(error)) {
        await this.repository.appendAuditEvent(this.audit(
          user, action, "User", record.id, context, "FAILED", "DUPLICATE_EMAIL", null, userAuditSnapshot(record)
        ));
        throw new Error("A local user with this email already exists");
      }
      throw error;
    }
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
      return await this.repository.updateUserWithAudit(
        userId,
        update,
        this.audit(
          user,
          action,
          "User",
          userId,
          context,
          "SUCCEEDED",
          undefined,
          userAuditSnapshot(target),
          userAuditSnapshot({ ...target, ...update })
        )
      );
    } catch (error) {
      if (error instanceof FinalActiveAdminError) {
        return this.reject(
          user,
          action,
          userId,
          context,
          "FINAL_ACTIVE_ADMIN",
          error.message,
          userAuditSnapshot(target),
          userAuditSnapshot(target)
        );
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
    message: string,
    before: CellAuditSnapshot | null = null,
    after: CellAuditSnapshot | null = null
  ): Promise<T> {
    await this.repository.appendAuditEvent(this.audit(
      user,
      action,
      action.startsWith("local-user") ? "User" : "CellConfiguration",
      targetId,
      context,
      "FAILED",
      error,
      before,
      after
    ));
    throw new Error(message);
  }

  private audit(
    user: CellAdminActor,
    action: string,
    targetType: string,
    targetId: string,
    context: { correlationId: string; reason: string },
    result: "SUCCEEDED" | "FAILED",
    error?: string,
    before: CellAuditSnapshot | null = null,
    after: CellAuditSnapshot | null = null
  ): CellAuditEventRecord {
    return {
      id: `audit_${randomUUID()}`,
      actorId: user.id,
      action,
      targetType,
      targetId,
      correlationId: context.correlationId,
      reason: context.reason,
      before,
      after,
      result,
      error,
      occurredAt: this.now()
    };
  }
}

function configurationAuditSnapshot(configuration: Partial<CellConfigurationRecord>): CellAuditSnapshot {
  return {
    displayName: configuration.displayName ?? null,
    logoUrl: configuration.logoUrl ?? null,
    supportUrl: configuration.supportUrl ?? null,
    legalUrl: configuration.legalUrl ?? null,
    primaryColor: configuration.primaryColor ?? null,
    locale: configuration.locale ?? null,
    timezone: configuration.timezone ?? null,
    defaultCurrency: configuration.defaultCurrency ?? null,
    enabledModules: configuration.enabledModules ? [...configuration.enabledModules] : [],
    allowedModules: configuration.allowedModules ? [...configuration.allowedModules] : [],
    planCode: configuration.planCode ?? null,
    revision: configuration.revision ?? 0
  };
}

function userAuditSnapshot(user: LocalUserRecord): CellAuditSnapshot {
  return { id: user.id, name: user.name, email: user.email, role: user.role, active: user.active };
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
    ? {
        ...options.configuration,
        supportUrl: options.configuration.supportUrl ?? null,
        legalUrl: options.configuration.legalUrl ?? null,
        revision: options.configuration.revision ?? 0,
        enabledModules: [...options.configuration.enabledModules], allowedModules: [...options.configuration.allowedModules]
      }
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
            id: "default", displayName: "eCRM", logoUrl: null, supportUrl: null, legalUrl: null, primaryColor: "#1e3a5f", locale: "en-US", timezone: "UTC",
            defaultCurrency: businessCurrency, enabledModules: [], allowedModules: [...allowedModules], planCode: "UNASSIGNED",
            revision: 0,
            createdAt: new Date(), updatedAt: new Date()
          }
        : undefined,
    updateConfigurationWithAudit: async (next, expectedRevision, audit) => {
      if ((configuration?.revision ?? 0) !== expectedRevision) return undefined;
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

function safePublicHttps(value: string | null | undefined): boolean {
  if (value === undefined || value === null || value.trim() === "") return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && host !== "169.254.169.254"
      && !host.startsWith("10.") && !host.startsWith("192.168.") && !/^172\.(1[6-9]|2\d|3[01])\./.test(host);
  } catch {
    return false;
  }
}

function isDuplicateEmail(error: unknown): boolean {
  return (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")
    || (error instanceof Error && /email.*already exists|unique constraint/i.test(error.message));
}
