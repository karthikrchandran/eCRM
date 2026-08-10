type DatabaseTarget = {
  host: string;
  port: string;
  database: string;
  schema: string;
  username: string;
};

function parseDatabaseUrl(name: string, value: string | undefined): { url: string; target: DatabaseTarget } {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${name} is required for database integration tests.`);
  const parsed = new URL(normalized);
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${name} must be a PostgreSQL URL.`);
  }
  return {
    url: normalized,
    target: {
      host: parsed.hostname.toLowerCase(),
      port: parsed.port || "5432",
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
      schema: parsed.searchParams.get("schema") ?? "public",
      username: decodeURIComponent(parsed.username)
    }
  };
}

function targetKey(target: DatabaseTarget) {
  return [target.host, target.port, target.database, target.schema].join("/");
}

export function validateDisposableDatabaseUrls(
  ownerValue: string | undefined,
  tenantValue: string | undefined,
  ordinaryApplicationUrls: Array<string | undefined> = [
    process.env.DATABASE_URL,
    process.env.CONTROL_PLANE_DATABASE_URL,
    process.env.TENANT_DATABASE_URL
  ]
) {
  const owner = parseDatabaseUrl("TEST_DATABASE_URL", ownerValue);
  const tenant = parseDatabaseUrl("TEST_TENANT_DATABASE_URL", tenantValue);
  if (targetKey(owner.target) !== targetKey(tenant.target)) {
    throw new Error("Test database URLs must target the same canonical host, port, database, and schema.");
  }
  if (!/(?:test|wp4|disposable|rehearsal)/i.test(owner.target.database)) {
    throw new Error("Test database name must contain an explicit disposable marker.");
  }
  if (owner.target.username === tenant.target.username) {
    throw new Error("Owner and tenant test URLs must use different database logins.");
  }
  for (const ordinaryValue of ordinaryApplicationUrls) {
    if (!ordinaryValue?.trim()) continue;
    const ordinary = parseDatabaseUrl("ordinary application database URL", ordinaryValue);
    if (targetKey(ordinary.target) === targetKey(owner.target)) {
      throw new Error("Disposable tests must not target an ordinary application database.");
    }
  }
  return { ownerUrl: owner.url, tenantUrl: tenant.url };
}
