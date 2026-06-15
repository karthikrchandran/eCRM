import bcrypt from "bcryptjs";
import { PipelineStageKind, PrismaClient, UserRole } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run the local seed script in production.");
}

const prisma = new PrismaClient();

const defaultStages = [
  { id: "seed_stage_lead", name: "Lead", sortOrder: 10, kind: PipelineStageKind.OPEN },
  { id: "seed_stage_qualified", name: "Qualified", sortOrder: 20, kind: PipelineStageKind.OPEN },
  { id: "seed_stage_proposal_sent", name: "Proposal Sent", sortOrder: 30, kind: PipelineStageKind.OPEN },
  { id: "seed_stage_negotiation", name: "Negotiation", sortOrder: 40, kind: PipelineStageKind.OPEN },
  { id: "seed_stage_won", name: "Won", sortOrder: 50, kind: PipelineStageKind.WON },
  { id: "seed_stage_lost", name: "Lost", sortOrder: 60, kind: PipelineStageKind.LOST },
  { id: "seed_stage_dormant", name: "Dormant", sortOrder: 70, kind: PipelineStageKind.DORMANT }
];

const defaultProductServices = [
  {
    id: "seed_product_elearning",
    name: "eLearning",
    code: "ELEARNING",
    category: "eLearning",
    description: "Script, storyboard, voiceover, editing, review, edits, and completion.",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "elearning",
    sortOrder: 10
  },
  {
    id: "seed_product_video_shoot",
    name: "Video shoot",
    code: "VIDEO-SHOOT",
    category: "Video shoot",
    description: "Script, shoot, voiceover, editing, review, edits, and completion.",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "video_shoot",
    sortOrder: 20
  },
  {
    id: "seed_product_vr_ar",
    name: "VR/AR",
    code: "VR-AR",
    category: "VR/AR",
    description: "Script, development, voiceover, editing, review, edits, and completion.",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "vr_ar",
    sortOrder: 30
  },
  {
    id: "seed_product_animation",
    name: "Animation",
    code: "ANIMATION",
    category: "Animation",
    description: "Script, modeling, voiceover, editing, review, edits, and completion.",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: "animation",
    sortOrder: 40
  },
  {
    id: "seed_product_other_service",
    name: "Other service",
    code: "OTHER-SERVICE",
    category: "Other service",
    description: "General service category for proposal lines that do not map to a production template yet.",
    defaultGstRateBps: 1800,
    defaultProductionTemplateKey: null,
    sortOrder: 50
  }
];

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

  for (const stage of defaultStages) {
    await prisma.pipelineStage.upsert({
      where: { id: stage.id },
      update: {
        active: true,
        kind: stage.kind,
        name: stage.name,
        sortOrder: stage.sortOrder
      },
      create: {
        ...stage,
        active: true
      }
    });
  }

  const opportunity = await prisma.opportunity.upsert({
    where: { id: "seed_opportunity_acme_lms_rollout" },
    update: {
      branchId: "seed_branch_acme_bengaluru",
      estimatedValueInr: "1250000.00",
      lastReachAt: new Date("2026-06-14T10:00:00.000Z"),
      leadCustomerId: sampleLead.id,
      nextFollowUpAt: new Date("2026-06-20T10:00:00.000Z"),
      notes: "Seed opportunity for pipeline smoke checks.",
      ownerId: sales.id,
      probability: 60,
      productInterest: "Custom LMS rollout",
      stageId: "seed_stage_qualified",
      title: "Acme LMS rollout",
      updatedById: admin.id
    },
    create: {
      id: "seed_opportunity_acme_lms_rollout",
      branchId: "seed_branch_acme_bengaluru",
      createdById: admin.id,
      estimatedValueInr: "1250000.00",
      lastReachAt: new Date("2026-06-14T10:00:00.000Z"),
      leadCustomerId: sampleLead.id,
      nextFollowUpAt: new Date("2026-06-20T10:00:00.000Z"),
      notes: "Seed opportunity for pipeline smoke checks.",
      ownerId: sales.id,
      probability: 60,
      productInterest: "Custom LMS rollout",
      stageId: "seed_stage_qualified",
      title: "Acme LMS rollout",
      updatedById: admin.id
    }
  });

  await prisma.opportunityOwnerSplit.upsert({
    where: {
      opportunityId_userId: {
        opportunityId: opportunity.id,
        userId: sales.id
      }
    },
    update: { percent: 100 },
    create: {
      opportunityId: opportunity.id,
      percent: 100,
      userId: sales.id
    }
  });

  await prisma.salesTarget.upsert({
    where: {
      ownerId_financialYear_quarter: {
        financialYear: 2026,
        ownerId: sales.id,
        quarter: 1
      }
    },
    update: {
      targetValueInr: "1000000.00"
    },
    create: {
      createdById: admin.id,
      financialYear: 2026,
      ownerId: sales.id,
      quarter: 1,
      targetValueInr: "1000000.00"
    }
  });

  for (const product of defaultProductServices) {
    await prisma.productService.upsert({
      where: { id: product.id },
      update: {
        active: true,
        category: product.category,
        code: product.code,
        defaultGstRateBps: product.defaultGstRateBps,
        defaultProductionTemplateKey: product.defaultProductionTemplateKey,
        description: product.description,
        name: product.name,
        sortOrder: product.sortOrder,
        updatedById: admin.id
      },
      create: {
        ...product,
        active: true,
        createdById: admin.id,
        updatedById: admin.id
      }
    });
  }
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
