import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the local seed script in production.");
}

const prisma = new PrismaClient();

async function upsertUser(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      passwordHash,
      role: input.role,
      active: true
    },
    create: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      active: true
    }
  });
}

async function main() {
  await upsertUser({
    name: "Admin User",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    role: UserRole.ADMIN
  });

  await upsertUser({
    name: "Sales User",
    email: process.env.SEED_SALES_EMAIL ?? "sales@example.com",
    password: process.env.SEED_SALES_PASSWORD ?? "Sales@12345",
    role: UserRole.SALES
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const salesEmail = process.env.SEED_SALES_EMAIL ?? "sales@example.com";

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const sales = await prisma.user.findUniqueOrThrow({ where: { email: salesEmail } });

  const sampleLead = await prisma.leadCustomer.upsert({
    where: { id: "seed_lead_acme_learning" },
    update: {
      name: "Acme Learning Pvt Ltd",
      state: "LEAD",
      industry: "Education",
      source: "Referral",
      ownerId: sales.id,
      notes: "Seed lead for CRM core smoke checks.",
      updatedById: admin.id
    },
    create: {
      id: "seed_lead_acme_learning",
      name: "Acme Learning Pvt Ltd",
      state: "LEAD",
      industry: "Education",
      source: "Referral",
      ownerId: sales.id,
      notes: "Seed lead for CRM core smoke checks.",
      createdById: admin.id,
      updatedById: admin.id
    }
  });

  await prisma.branch.upsert({
    where: { id: "seed_branch_acme_bengaluru" },
    update: {
      name: "Bengaluru Branch",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      salesContext: "Primary learning and development team"
    },
    create: {
      id: "seed_branch_acme_bengaluru",
      leadCustomerId: sampleLead.id,
      name: "Bengaluru Branch",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      salesContext: "Primary learning and development team"
    }
  });

  await prisma.contact.upsert({
    where: { id: "seed_contact_acme_anita" },
    update: {
      name: "Anita Rao",
      designation: "L&D Manager",
      email: "anita.rao@example.com",
      phone: "+91 98765 43210",
      isPrimary: true
    },
    create: {
      id: "seed_contact_acme_anita",
      leadCustomerId: sampleLead.id,
      branchId: "seed_branch_acme_bengaluru",
      name: "Anita Rao",
      designation: "L&D Manager",
      email: "anita.rao@example.com",
      phone: "+91 98765 43210",
      isPrimary: true
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed_activity_acme_followup" },
    update: {
      ownerId: sales.id,
      status: "OPEN",
      subject: "Follow up on onboarding module requirements",
      dueAt: new Date("2026-06-20T10:00:00.000Z")
    },
    create: {
      id: "seed_activity_acme_followup",
      leadCustomerId: sampleLead.id,
      branchId: "seed_branch_acme_bengaluru",
      contactId: "seed_contact_acme_anita",
      ownerId: sales.id,
      createdById: admin.id,
      type: "FOLLOW_UP",
      status: "OPEN",
      subject: "Follow up on onboarding module requirements",
      dueAt: new Date("2026-06-20T10:00:00.000Z")
    }
  });

  await prisma.leadOwnershipHistory.upsert({
    where: { id: "seed_history_acme_admin_to_sales" },
    update: {
      fromOwnerId: admin.id,
      toOwnerId: sales.id,
      changedById: admin.id,
      reason: "Initial seed assignment for CRM core smoke checks."
    },
    create: {
      id: "seed_history_acme_admin_to_sales",
      leadCustomerId: sampleLead.id,
      fromOwnerId: admin.id,
      toOwnerId: sales.id,
      changedById: admin.id,
      reason: "Initial seed assignment for CRM core smoke checks."
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
