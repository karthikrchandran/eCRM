import { tenantSeedFixtures, type TenantSeedKey } from "../../../prisma/tenant-seed-fixtures";

type DemoCellContractResult = {
  ok: boolean;
  cell?: {
    key: TenantSeedKey;
    cellId: string;
    displayName: string;
  };
  errors: string[];
  warnings: string[];
};

const demoCells = {
  "ara-global": {
    signalLoopWorkspaceId: "workspace_ara_global"
  },
  "ai-consulting": {
    signalLoopWorkspaceId: "workspace_ai_consulting"
  }
} satisfies Record<TenantSeedKey, { signalLoopWorkspaceId: string }>;

export function validateDemoCellContract(environment: Record<string, string | undefined>): DemoCellContractResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tenantSeed = environment.TENANT_SEED as TenantSeedKey | undefined;

  if (!tenantSeed || !(tenantSeed in tenantSeedFixtures)) {
    errors.push("TENANT_SEED must be ara-global or ai-consulting.");
    return { ok: false, errors, warnings };
  }

  const fixture = tenantSeedFixtures[tenantSeed];
  const expected = demoCells[tenantSeed];

  requireEqual(environment.APP_MODE, "cell", "APP_MODE", errors);
  requireEqual(environment.CELL_ID, fixture.cellId, "CELL_ID", errors, `CELL_ID must be ${fixture.cellId} for ${tenantSeed}.`);
  requireEqual(environment.CELL_KEY, tenantSeed, "CELL_KEY", errors, `CELL_KEY must be ${tenantSeed}.`);
  requirePostgresUrl(environment.DATABASE_URL, "DATABASE_URL", errors);
  requireMinLength(environment.AUTH_SECRET, 32, "AUTH_SECRET", errors);
  requireUrl(environment.APP_BASE_URL, "APP_BASE_URL", errors);

  if (environment.NODE_ENV === "production" && environment.AUTH_MODE === "local-test") {
    errors.push("AUTH_MODE=local-test is not allowed when NODE_ENV=production.");
  }

  if (!environment.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN is not configured; durable deployed voice-note audio storage is not proven.");
  }

  validateSignalLoopDestination(environment, expected.signalLoopWorkspaceId, errors, warnings);

  return {
    ok: errors.length === 0,
    cell: {
      key: tenantSeed,
      cellId: fixture.cellId,
      displayName: fixture.displayName
    },
    errors,
    warnings
  };
}

function requireEqual(actual: string | undefined, expected: string, field: string, errors: string[], message = `${field} must be ${expected}.`) {
  if (actual !== expected) errors.push(message);
}

function requireMinLength(actual: string | undefined, length: number, field: string, errors: string[]) {
  if (!actual || actual.length < length) errors.push(`${field} must be at least ${length} characters.`);
}

function requirePostgresUrl(actual: string | undefined, field: string, errors: string[]) {
  if (!actual || !/^postgres(ql)?:\/\//.test(actual)) errors.push(`${field} must be a PostgreSQL connection URL.`);
}

function requireUrl(actual: string | undefined, field: string, errors: string[]) {
  if (!actual) {
    errors.push(`${field} must be a valid URL.`);
    return;
  }
  try {
    new URL(actual);
  } catch {
    errors.push(`${field} must be a valid URL.`);
  }
}

function validateSignalLoopDestination(
  environment: Record<string, string | undefined>,
  expectedWorkspaceId: string,
  errors: string[],
  warnings: string[]
) {
  const keys = ["INTEGRATION_DESTINATION_URL", "INTEGRATION_DESTINATION_INSTALLATION", "INTEGRATION_DESTINATION_TOKEN"] as const;
  const provided = keys.filter((key) => Boolean(environment[key]));
  if (provided.length === 0) {
    warnings.push("SignalLoop delivery destination is not configured; integration delivery smoke is not proven.");
    return;
  }
  for (const key of keys) {
    if (!environment[key]) errors.push(`${key} is required when configuring SignalLoop delivery.`);
  }
  if (environment.INTEGRATION_DESTINATION_URL && !environment.INTEGRATION_DESTINATION_URL.startsWith("https://")) {
    errors.push("INTEGRATION_DESTINATION_URL must use https://.");
  }
  if (environment.INTEGRATION_DESTINATION_INSTALLATION && environment.INTEGRATION_DESTINATION_INSTALLATION !== expectedWorkspaceId) {
    errors.push(`INTEGRATION_DESTINATION_INSTALLATION must be ${expectedWorkspaceId}.`);
  }
}
