import bcrypt from "bcryptjs";
import { OrderStatus, PipelineStageKind, PrismaClient, ProposalStatus, UserRole } from "@prisma/client";
import { demoProductionWorkItems, demoProposalLineItems, demoProposalTotals } from "./seed-fixtures";

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

const defaultProductionTemplates = [
  {
    id: "seed_production_template_elearning",
    key: "elearning",
    name: "eLearning production",
    description: "Default stages for eLearning module delivery.",
    sortOrder: 10,
    stages: [
      { id: "seed_production_stage_elearning_script", key: "script", name: "Script", sortOrder: 10, defaultDurationDays: 3 },
      { id: "seed_production_stage_elearning_storyboard", key: "storyboard", name: "Storyboard", sortOrder: 20, defaultDurationDays: 4 },
      { id: "seed_production_stage_elearning_development", key: "development", name: "Development", sortOrder: 30, defaultDurationDays: 10 },
      { id: "seed_production_stage_elearning_voiceover", key: "voiceover", name: "Voiceover", sortOrder: 40, defaultDurationDays: 3 },
      { id: "seed_production_stage_elearning_review", key: "review", name: "Review and edits", sortOrder: 50, defaultDurationDays: 5 },
      { id: "seed_production_stage_elearning_delivery", key: "delivery", name: "Final delivery", sortOrder: 60, defaultDurationDays: 2 }
    ]
  },
  {
    id: "seed_production_template_video_shoot",
    key: "video_shoot",
    name: "Video shoot production",
    description: "Default stages for scripted video production.",
    sortOrder: 20,
    stages: [
      { id: "seed_production_stage_video_script", key: "script", name: "Script", sortOrder: 10, defaultDurationDays: 3 },
      { id: "seed_production_stage_video_preproduction", key: "pre_production", name: "Pre-production", sortOrder: 20, defaultDurationDays: 4 },
      { id: "seed_production_stage_video_shoot", key: "shoot", name: "Shoot", sortOrder: 30, defaultDurationDays: 2 },
      { id: "seed_production_stage_video_edit", key: "edit", name: "Edit", sortOrder: 40, defaultDurationDays: 7 },
      { id: "seed_production_stage_video_review", key: "review", name: "Review and edits", sortOrder: 50, defaultDurationDays: 5 },
      { id: "seed_production_stage_video_delivery", key: "delivery", name: "Final delivery", sortOrder: 60, defaultDurationDays: 2 }
    ]
  },
  {
    id: "seed_production_template_vr_ar",
    key: "vr_ar",
    name: "VR/AR production",
    description: "Default stages for VR and AR delivery.",
    sortOrder: 30,
    stages: [
      { id: "seed_production_stage_vr_discovery", key: "discovery", name: "Discovery", sortOrder: 10, defaultDurationDays: 3 },
      { id: "seed_production_stage_vr_design", key: "design", name: "Experience design", sortOrder: 20, defaultDurationDays: 5 },
      { id: "seed_production_stage_vr_development", key: "development", name: "Development", sortOrder: 30, defaultDurationDays: 12 },
      { id: "seed_production_stage_vr_testing", key: "testing", name: "Testing", sortOrder: 40, defaultDurationDays: 5 },
      { id: "seed_production_stage_vr_review", key: "review", name: "Review and edits", sortOrder: 50, defaultDurationDays: 5 },
      { id: "seed_production_stage_vr_delivery", key: "delivery", name: "Final delivery", sortOrder: 60, defaultDurationDays: 2 }
    ]
  },
  {
    id: "seed_production_template_animation",
    key: "animation",
    name: "Animation production",
    description: "Default stages for animation delivery.",
    sortOrder: 40,
    stages: [
      { id: "seed_production_stage_animation_script", key: "script", name: "Script", sortOrder: 10, defaultDurationDays: 3 },
      { id: "seed_production_stage_animation_storyboard", key: "storyboard", name: "Storyboard", sortOrder: 20, defaultDurationDays: 4 },
      { id: "seed_production_stage_animation_animation", key: "animation", name: "Modeling and animation", sortOrder: 30, defaultDurationDays: 12 },
      { id: "seed_production_stage_animation_voiceover", key: "voiceover", name: "Voiceover", sortOrder: 40, defaultDurationDays: 3 },
      { id: "seed_production_stage_animation_review", key: "review", name: "Review and edits", sortOrder: 50, defaultDurationDays: 5 },
      { id: "seed_production_stage_animation_delivery", key: "delivery", name: "Final delivery", sortOrder: 60, defaultDurationDays: 2 }
    ]
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
    name: "Kavya Iyer",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    role: UserRole.ADMIN
  });

  await upsertUser({
    name: "Priya Menon",
    email: process.env.SEED_SALES_EMAIL ?? "sales@example.com",
    password: process.env.SEED_SALES_PASSWORD ?? "Sales@12345",
    role: UserRole.SALES
  });

  await upsertUser({
    name: "Arjun Srinivasan",
    email: process.env.SEED_SALES2_EMAIL ?? "sales2@example.com",
    password: process.env.SEED_SALES2_PASSWORD ?? "Sales2@12345",
    role: UserRole.SALES
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const salesEmail = process.env.SEED_SALES_EMAIL ?? "sales@example.com";
  const arjunEmail = process.env.SEED_SALES2_EMAIL ?? "sales2@example.com";

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } });
  const sales = await prisma.user.findUniqueOrThrow({ where: { email: salesEmail } });
  const arjun = await prisma.user.findUniqueOrThrow({ where: { email: arjunEmail } });

  const sampleLead = await prisma.leadCustomer.upsert({
    where: { id: "seed_lead_acme_learning" },
    update: {
      name: "Northstar Learning Pvt Ltd",
      state: "LEAD",
      industry: "Education",
      source: "Referral",
      ownerId: sales.id,
      notes: "Exploring a phased LMS modernization program for new-hire onboarding.",
      updatedById: admin.id
    },
    create: {
      id: "seed_lead_acme_learning",
      name: "Northstar Learning Pvt Ltd",
      state: "LEAD",
      industry: "Education",
      source: "Referral",
      ownerId: sales.id,
      notes: "Exploring a phased LMS modernization program for new-hire onboarding.",
      createdById: admin.id,
      updatedById: admin.id
    }
  });

  await prisma.branch.upsert({
    where: { id: "seed_branch_acme_bengaluru" },
    update: {
      name: "Bengaluru Delivery Office",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      salesContext: "Primary learning operations and enablement team"
    },
    create: {
      id: "seed_branch_acme_bengaluru",
      leadCustomerId: sampleLead.id,
      name: "Bengaluru Delivery Office",
      city: "Bengaluru",
      region: "Karnataka",
      country: "India",
      salesContext: "Primary learning operations and enablement team"
    }
  });

  await prisma.contact.upsert({
    where: { id: "seed_contact_acme_anita" },
    update: {
      name: "Anita Rao",
      designation: "Head of Learning Operations",
      email: "anita.rao@northstar.example",
      phone: "+91 98765 43210",
      isPrimary: true
    },
    create: {
      id: "seed_contact_acme_anita",
      leadCustomerId: sampleLead.id,
      branchId: "seed_branch_acme_bengaluru",
      name: "Anita Rao",
      designation: "Head of Learning Operations",
      email: "anita.rao@northstar.example",
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
      reason: "Assigned to Priya after referral qualification."
    },
    create: {
      id: "seed_history_acme_admin_to_sales",
      leadCustomerId: sampleLead.id,
      fromOwnerId: admin.id,
      toOwnerId: sales.id,
      changedById: admin.id,
      reason: "Assigned to Priya after referral qualification."
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
      notes: "Client wants a modular rollout that can expand across business units after pilot approval.",
      ownerId: sales.id,
      probability: 60,
      productInterest: "LMS modernization and onboarding content",
      stageId: "seed_stage_qualified",
      title: "Northstar LMS modernization",
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
      notes: "Client wants a modular rollout that can expand across business units after pilot approval.",
      ownerId: sales.id,
      probability: 60,
      productInterest: "LMS modernization and onboarding content",
      stageId: "seed_stage_qualified",
      title: "Northstar LMS modernization",
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

  const arjunLead = await prisma.leadCustomer.upsert({
    where: { id: "seed_lead_zenith_health" },
    update: {
      name: "Zenith Health Systems",
      state: "CUSTOMER",
      industry: "Healthcare",
      source: "Web inquiry",
      ownerId: arjun.id,
      notes: "Existing customer evaluating a multilingual compliance-learning refresh.",
      updatedById: admin.id
    },
    create: {
      id: "seed_lead_zenith_health",
      name: "Zenith Health Systems",
      state: "CUSTOMER",
      industry: "Healthcare",
      source: "Web inquiry",
      ownerId: arjun.id,
      notes: "Existing customer evaluating a multilingual compliance-learning refresh.",
      createdById: admin.id,
      updatedById: admin.id
    }
  });

  await prisma.branch.upsert({
    where: { id: "seed_branch_zenith_mumbai" },
    update: {
      name: "Mumbai Corporate Office",
      city: "Mumbai",
      region: "Maharashtra",
      country: "India",
      salesContext: "Central HR and compliance training stakeholders"
    },
    create: {
      id: "seed_branch_zenith_mumbai",
      leadCustomerId: arjunLead.id,
      name: "Mumbai Corporate Office",
      city: "Mumbai",
      region: "Maharashtra",
      country: "India",
      salesContext: "Central HR and compliance training stakeholders"
    }
  });

  await prisma.contact.upsert({
    where: { id: "seed_contact_zenith_meera" },
    update: {
      name: "Meera Shah",
      designation: "VP People Operations",
      email: "meera.shah@zenith-health.example",
      phone: "+91 99887 76655",
      isPrimary: true
    },
    create: {
      id: "seed_contact_zenith_meera",
      leadCustomerId: arjunLead.id,
      branchId: "seed_branch_zenith_mumbai",
      name: "Meera Shah",
      designation: "VP People Operations",
      email: "meera.shah@zenith-health.example",
      phone: "+91 99887 76655",
      isPrimary: true
    }
  });

  await prisma.activity.upsert({
    where: { id: "seed_activity_zenith_renewal_review" },
    update: {
      ownerId: arjun.id,
      status: "OPEN",
      subject: "Review compliance-learning renewal scope",
      dueAt: new Date("2026-06-24T11:00:00.000Z")
    },
    create: {
      id: "seed_activity_zenith_renewal_review",
      leadCustomerId: arjunLead.id,
      branchId: "seed_branch_zenith_mumbai",
      contactId: "seed_contact_zenith_meera",
      ownerId: arjun.id,
      createdById: admin.id,
      type: "MEETING",
      status: "OPEN",
      subject: "Review compliance-learning renewal scope",
      dueAt: new Date("2026-06-24T11:00:00.000Z")
    }
  });

  await prisma.leadOwnershipHistory.upsert({
    where: { id: "seed_history_zenith_admin_to_arjun" },
    update: {
      fromOwnerId: admin.id,
      toOwnerId: arjun.id,
      changedById: admin.id,
      reason: "Assigned to Arjun for healthcare account ownership."
    },
    create: {
      id: "seed_history_zenith_admin_to_arjun",
      leadCustomerId: arjunLead.id,
      fromOwnerId: admin.id,
      toOwnerId: arjun.id,
      changedById: admin.id,
      reason: "Assigned to Arjun for healthcare account ownership."
    }
  });

  const arjunOpportunity = await prisma.opportunity.upsert({
    where: { id: "seed_opportunity_zenith_compliance_refresh" },
    update: {
      branchId: "seed_branch_zenith_mumbai",
      estimatedValueInr: "840000.00",
      lastReachAt: new Date("2026-06-18T12:00:00.000Z"),
      leadCustomerId: arjunLead.id,
      nextFollowUpAt: new Date("2026-06-24T11:00:00.000Z"),
      notes: "Customer wants updated compliance modules with Hindi and English voiceover.",
      ownerId: arjun.id,
      probability: 75,
      productInterest: "Compliance learning refresh and animation",
      stageId: "seed_stage_negotiation",
      title: "Zenith compliance learning refresh",
      updatedById: admin.id
    },
    create: {
      id: "seed_opportunity_zenith_compliance_refresh",
      branchId: "seed_branch_zenith_mumbai",
      createdById: admin.id,
      estimatedValueInr: "840000.00",
      lastReachAt: new Date("2026-06-18T12:00:00.000Z"),
      leadCustomerId: arjunLead.id,
      nextFollowUpAt: new Date("2026-06-24T11:00:00.000Z"),
      notes: "Customer wants updated compliance modules with Hindi and English voiceover.",
      ownerId: arjun.id,
      probability: 75,
      productInterest: "Compliance learning refresh and animation",
      stageId: "seed_stage_negotiation",
      title: "Zenith compliance learning refresh",
      updatedById: admin.id
    }
  });

  await prisma.opportunityOwnerSplit.upsert({
    where: {
      opportunityId_userId: {
        opportunityId: arjunOpportunity.id,
        userId: arjun.id
      }
    },
    update: { percent: 100 },
    create: {
      opportunityId: arjunOpportunity.id,
      percent: 100,
      userId: arjun.id
    }
  });

  await prisma.salesTarget.upsert({
    where: {
      ownerId_financialYear_quarter: {
        financialYear: 2026,
        ownerId: arjun.id,
        quarter: 1
      }
    },
    update: {
      targetValueInr: "900000.00"
    },
    create: {
      createdById: admin.id,
      financialYear: 2026,
      ownerId: arjun.id,
      quarter: 1,
      targetValueInr: "900000.00"
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

  for (const template of defaultProductionTemplates) {
    await prisma.productionTemplate.upsert({
      where: { id: template.id },
      update: {
        active: true,
        description: template.description,
        key: template.key,
        name: template.name,
        sortOrder: template.sortOrder
      },
      create: {
        id: template.id,
        active: true,
        description: template.description,
        key: template.key,
        name: template.name,
        sortOrder: template.sortOrder
      }
    });

    for (const stage of template.stages) {
      await prisma.productionTemplateStage.upsert({
        where: { id: stage.id },
        update: {
          defaultDurationDays: stage.defaultDurationDays,
          key: stage.key,
          name: stage.name,
          required: true,
          sortOrder: stage.sortOrder,
          templateId: template.id
        },
        create: {
          id: stage.id,
          defaultDurationDays: stage.defaultDurationDays,
          key: stage.key,
          name: stage.name,
          required: true,
          sortOrder: stage.sortOrder,
          templateId: template.id
        }
      });
    }
  }

  const acceptedProposal = await prisma.proposal.upsert({
    where: { id: "seed_proposal_acme_lms_accepted" },
    update: {
      assumptions: "Client provides SME availability and branding inputs.",
      commercialSummary: "Accepted commercial proposal for the Northstar LMS modernization seed order flow.",
      currency: "INR",
      deliveryTimeline: "Six weeks from kickoff.",
      exclusions: "Translation and third-party LMS license costs.",
      inclusions: "Storyboard, development, voiceover, review, edits, and final package.",
      internalNotes: "Accepted scope is ready for order booking and production kickoff.",
      paymentTerms: "50 percent advance and 50 percent on delivery.",
      status: ProposalStatus.ACCEPTED,
      subtotalPaisa: demoProposalTotals.subtotalPaisa,
      gstPaisa: demoProposalTotals.gstPaisa,
      title: "Northstar LMS modernization proposal",
      totalPaisa: demoProposalTotals.totalPaisa,
      updatedById: admin.id,
      validUntil: new Date("2026-07-31T00:00:00.000Z"),
      versionLabel: "Seed accepted"
    },
    create: {
      id: "seed_proposal_acme_lms_accepted",
      assumptions: "Client provides SME availability and branding inputs.",
      commercialSummary: "Accepted commercial proposal for the Northstar LMS modernization seed order flow.",
      currency: "INR",
      deliveryTimeline: "Six weeks from kickoff.",
      exclusions: "Translation and third-party LMS license costs.",
      inclusions: "Storyboard, development, voiceover, review, edits, and final package.",
      internalNotes: "Accepted scope is ready for order booking and production kickoff.",
      opportunityId: opportunity.id,
      paymentTerms: "50 percent advance and 50 percent on delivery.",
      sequenceNumber: 9001,
      status: ProposalStatus.ACCEPTED,
      subtotalPaisa: demoProposalTotals.subtotalPaisa,
      gstPaisa: demoProposalTotals.gstPaisa,
      title: "Northstar LMS modernization proposal",
      totalPaisa: demoProposalTotals.totalPaisa,
      createdById: admin.id,
      updatedById: admin.id,
      validUntil: new Date("2026-07-31T00:00:00.000Z"),
      versionLabel: "Seed accepted"
    }
  });

  for (const lineItem of demoProposalLineItems) {
    await prisma.proposalLineItem.upsert({
      where: { id: lineItem.id },
      update: {
        description: lineItem.description,
        gstRateBps: lineItem.gstRateBps,
        lineGstPaisa: lineItem.lineGstPaisa,
        lineSubtotalPaisa: lineItem.lineSubtotalPaisa,
        lineTotalPaisa: lineItem.lineTotalPaisa,
        productCategorySnapshot: lineItem.productCategorySnapshot,
        productNameSnapshot: lineItem.productNameSnapshot,
        productServiceId: lineItem.productServiceId,
        quantity: lineItem.quantity,
        sortOrder: lineItem.sortOrder,
        unitPricePaisa: lineItem.unitPricePaisa
      },
      create: {
        id: lineItem.id,
        description: lineItem.description,
        gstRateBps: lineItem.gstRateBps,
        lineGstPaisa: lineItem.lineGstPaisa,
        lineSubtotalPaisa: lineItem.lineSubtotalPaisa,
        lineTotalPaisa: lineItem.lineTotalPaisa,
        productCategorySnapshot: lineItem.productCategorySnapshot,
        productNameSnapshot: lineItem.productNameSnapshot,
        productServiceId: lineItem.productServiceId,
        proposalId: acceptedProposal.id,
        quantity: lineItem.quantity,
        sortOrder: lineItem.sortOrder,
        unitPricePaisa: lineItem.unitPricePaisa
      }
    });
  }

  await prisma.proposalPdfAttachment.upsert({
    where: { id: "seed_proposal_pdf_acme_lms_accepted" },
    update: {
      canvaDesignUrl: "https://www.canva.com/design/seed-acme-lms",
      fileSizeBytes: 204800,
      mimeType: "application/pdf",
      originalFileName: "northstar-lms-modernization-proposal.pdf",
      proposalId: acceptedProposal.id,
      replacedAt: null,
      sha256: "seed-acme-lms-proposal-sha256",
      storageKey: "https://example.com/proposals/northstar-lms-modernization-proposal.pdf",
      storageProvider: "external",
      storedFileName: "northstar-lms-modernization-proposal.pdf",
      uploadedById: admin.id
    },
    create: {
      id: "seed_proposal_pdf_acme_lms_accepted",
      canvaDesignUrl: "https://www.canva.com/design/seed-acme-lms",
      fileSizeBytes: 204800,
      mimeType: "application/pdf",
      originalFileName: "northstar-lms-modernization-proposal.pdf",
      proposalId: acceptedProposal.id,
      sha256: "seed-acme-lms-proposal-sha256",
      storageKey: "https://example.com/proposals/northstar-lms-modernization-proposal.pdf",
      storageProvider: "external",
      storedFileName: "northstar-lms-modernization-proposal.pdf",
      uploadedById: admin.id
    }
  });

  const demoOrder = await prisma.order.upsert({
    where: { proposalId: acceptedProposal.id },
    update: {
      branchId: "seed_branch_acme_bengaluru",
      bookedAt: new Date("2026-06-17T09:00:00.000Z"),
      currency: "INR",
      deliveryDueAt: new Date("2026-07-18T00:00:00.000Z"),
      gstPaisa: demoProposalTotals.gstPaisa,
      leadCustomerId: sampleLead.id,
      orderNumber: "ORD-2026-SEED-0001",
      ownerId: sales.id,
      status: OrderStatus.IN_PRODUCTION,
      subtotalPaisa: demoProposalTotals.subtotalPaisa,
      totalPaisa: demoProposalTotals.totalPaisa,
      updatedById: admin.id
    },
    create: {
      id: "seed_order_northstar_multi_service",
      branchId: "seed_branch_acme_bengaluru",
      bookedAt: new Date("2026-06-17T09:00:00.000Z"),
      createdById: admin.id,
      currency: "INR",
      deliveryDueAt: new Date("2026-07-18T00:00:00.000Z"),
      gstPaisa: demoProposalTotals.gstPaisa,
      leadCustomerId: sampleLead.id,
      opportunityId: opportunity.id,
      orderNumber: "ORD-2026-SEED-0001",
      ownerId: sales.id,
      proposalId: acceptedProposal.id,
      status: OrderStatus.IN_PRODUCTION,
      subtotalPaisa: demoProposalTotals.subtotalPaisa,
      totalPaisa: demoProposalTotals.totalPaisa,
      updatedById: admin.id
    }
  });

  await prisma.orderOwnerSplitSnapshot.upsert({
    where: {
      orderId_userId: {
        orderId: demoOrder.id,
        userId: sales.id
      }
    },
    update: { percent: 100 },
    create: {
      orderId: demoOrder.id,
      percent: 100,
      userId: sales.id
    }
  });

  const orderLineItemsByProposalLineId = new Map<string, string>();
  for (const workItem of demoProductionWorkItems) {
    const lineItem = demoProposalLineItems.find((item) => item.id === workItem.proposalLineItemId);

    if (!lineItem) {
      throw new Error(`Missing proposal line item fixture for ${workItem.proposalLineItemId}.`);
    }

    const orderLineItem = await prisma.orderLineItem.upsert({
      where: { proposalLineItemId: lineItem.id },
      update: {
        description: lineItem.description,
        gstRateBps: lineItem.gstRateBps,
        lineGstPaisa: lineItem.lineGstPaisa,
        lineSubtotalPaisa: lineItem.lineSubtotalPaisa,
        lineTotalPaisa: lineItem.lineTotalPaisa,
        orderId: demoOrder.id,
        productCategorySnapshot: lineItem.productCategorySnapshot,
        productNameSnapshot: lineItem.productNameSnapshot,
        productServiceId: lineItem.productServiceId,
        productionTemplateKeySnapshot: workItem.productionTemplateKey,
        quantity: lineItem.quantity,
        sortOrder: lineItem.sortOrder,
        unitPricePaisa: lineItem.unitPricePaisa
      },
      create: {
        id: workItem.orderLineItemId,
        description: lineItem.description,
        gstRateBps: lineItem.gstRateBps,
        lineGstPaisa: lineItem.lineGstPaisa,
        lineSubtotalPaisa: lineItem.lineSubtotalPaisa,
        lineTotalPaisa: lineItem.lineTotalPaisa,
        orderId: demoOrder.id,
        productCategorySnapshot: lineItem.productCategorySnapshot,
        productNameSnapshot: lineItem.productNameSnapshot,
        productServiceId: lineItem.productServiceId,
        productionTemplateKeySnapshot: workItem.productionTemplateKey,
        proposalLineItemId: lineItem.id,
        quantity: lineItem.quantity,
        sortOrder: lineItem.sortOrder,
        unitPricePaisa: lineItem.unitPricePaisa
      }
    });
    orderLineItemsByProposalLineId.set(lineItem.id, orderLineItem.id);
  }

  for (const workItem of demoProductionWorkItems) {
    const orderLineItemId = orderLineItemsByProposalLineId.get(workItem.proposalLineItemId);
    const template = defaultProductionTemplates.find((item) => item.key === workItem.productionTemplateKey);
    const startedAt = "startedAt" in workItem ? workItem.startedAt : null;
    const completedAt = "completedAt" in workItem ? workItem.completedAt : null;

    if (!orderLineItemId) {
      throw new Error(`Missing order line item for ${workItem.proposalLineItemId}.`);
    }

    if (!template) {
      throw new Error(`Missing production template fixture for ${workItem.productionTemplateKey}.`);
    }

    await prisma.productionWorkItem.upsert({
      where: { id: workItem.id },
      update: {
        assignedToId: sales.id,
        completedAt,
        dueAt: workItem.dueAt,
        orderLineItemId,
        productCategorySnapshot: workItem.productCategorySnapshot,
        productNameSnapshot: workItem.productNameSnapshot,
        productionTemplateId: workItem.productionTemplateId,
        startedAt,
        status: workItem.status,
        title: workItem.title,
        updatedById: admin.id
      },
      create: {
        id: workItem.id,
        assignedToId: sales.id,
        completedAt,
        createdById: admin.id,
        dueAt: workItem.dueAt,
        orderLineItemId,
        productCategorySnapshot: workItem.productCategorySnapshot,
        productNameSnapshot: workItem.productNameSnapshot,
        productionTemplateId: workItem.productionTemplateId,
        startedAt,
        status: workItem.status,
        title: workItem.title,
        updatedById: admin.id
      }
    });

    const stageStatusByKey = workItem.stageStatusByKey as Record<string, "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "DONE" | "SKIPPED">;
    for (const templateStage of template.stages) {
      const stageStatus = stageStatusByKey[templateStage.key] ?? "NOT_STARTED";
      const stageStartedAt = stageStatus === "NOT_STARTED" ? null : startedAt;
      const stageCompletedAt = stageStatus === "DONE" || stageStatus === "SKIPPED" ? completedAt ?? new Date("2026-06-21T17:00:00.000Z") : null;

      await prisma.productionStageInstance.upsert({
        where: { id: `${workItem.id}_${templateStage.key}` },
        update: {
          assignedToId: sales.id,
          completedAt: stageCompletedAt,
          completedById: stageCompletedAt ? admin.id : null,
          description: null,
          dueAt: workItem.dueAt,
          name: templateStage.name,
          required: true,
          sortOrder: templateStage.sortOrder,
          startedAt: stageStartedAt,
          status: stageStatus,
          templateStageId: templateStage.id
        },
        create: {
          id: `${workItem.id}_${templateStage.key}`,
          assignedToId: sales.id,
          completedAt: stageCompletedAt,
          completedById: stageCompletedAt ? admin.id : null,
          description: null,
          dueAt: workItem.dueAt,
          name: templateStage.name,
          required: true,
          sortOrder: templateStage.sortOrder,
          startedAt: stageStartedAt,
          status: stageStatus,
          templateStageId: templateStage.id,
          workItemId: workItem.id
        }
      });
    }
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
