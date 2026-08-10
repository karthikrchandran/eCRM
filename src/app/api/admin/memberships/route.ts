import { z } from "zod";
import { getControlPlaneDb } from "@/server/db";
import { getCurrentOrganizationContext } from "@/server/organizations/context";

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ADMIN", "SALES", "FINANCE", "PRODUCTION", "READ_ONLY"]).default("SALES")
}).strict();

const statusSchema = z.object({
  membershipId: z.string().trim().min(1).max(128),
  status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"])
}).strict();

type AdminContext = NonNullable<Awaited<ReturnType<typeof getCurrentOrganizationContext>>>;

async function authorize(): Promise<{ context: AdminContext } | Response> {
  const context = await getCurrentOrganizationContext();
  if (!context) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (context.role !== "OWNER" && context.role !== "ADMIN") {
    return Response.json({ error: "Organization administrator access required." }, { status: 403 });
  }
  return { context };
}

function parseJson(request: Request) {
  return request.json().catch(() => {
    throw new Error("INVALID_JSON");
  });
}

export async function GET() {
  const authorization = await authorize();
  if (authorization instanceof Response) return authorization;
  const memberships = await getControlPlaneDb().organizationMembership.findMany({
    where: { organizationId: authorization.context.organizationId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: { id: true, organizationId: true, role: true, status: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true, active: true } } }
  });
  return Response.json({ memberships, organizationId: authorization.context.organizationId });
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if (authorization instanceof Response) return authorization;
  let body: unknown;
  try { body = await parseJson(request); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid membership invitation.", details: parsed.error.flatten().fieldErrors }, { status: 400 });

  const db = getControlPlaneDb();
  const user = await db.user.upsert({
    where: { email: parsed.data.email.toLowerCase() },
    update: { name: parsed.data.name },
    create: { email: parsed.data.email.toLowerCase(), name: parsed.data.name, role: parsed.data.role === "ADMIN" ? "ADMIN" : "SALES" }
  });
  const existing = await db.organizationMembership.findFirst({ where: { organizationId: authorization.context.organizationId, userId: user.id } });
  if (existing) return Response.json({ error: "User already has a membership in this organization." }, { status: 409 });
  const membership = await db.organizationMembership.create({
    data: { organizationId: authorization.context.organizationId, userId: user.id, role: parsed.data.role, status: "INVITED" },
    select: { id: true, organizationId: true, role: true, status: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true, active: true } } }
  });
  return Response.json({ membership, audit: { action: "membership.invited", actorId: authorization.context.userId, organizationId: authorization.context.organizationId } }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authorization = await authorize();
  if (authorization instanceof Response) return authorization;
  let body: unknown;
  try { body = await parseJson(request); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid membership update.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  if (parsed.data.membershipId === authorization.context.membershipId && parsed.data.status !== "ACTIVE") {
    return Response.json({ error: "You cannot deactivate your current membership." }, { status: 400 });
  }
  const db = getControlPlaneDb();
  const existing = await db.organizationMembership.findFirst({ where: { id: parsed.data.membershipId, organizationId: authorization.context.organizationId } });
  if (!existing) return Response.json({ error: "Membership not found." }, { status: 404 });
  const membership = await db.organizationMembership.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
    select: { id: true, organizationId: true, role: true, status: true, createdAt: true, updatedAt: true, user: { select: { id: true, name: true, email: true, active: true } } }
  });
  return Response.json({ membership, audit: { action: `membership.${parsed.data.status.toLowerCase()}`, actorId: authorization.context.userId, organizationId: authorization.context.organizationId } });
}
