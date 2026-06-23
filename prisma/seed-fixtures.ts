export const demoProposalLineItems = [
  {
    id: "seed_proposal_line_elearning",
    description: "Interactive onboarding module package.",
    gstRateBps: 1800,
    lineGstPaisa: 90000,
    lineSubtotalPaisa: 500000,
    lineTotalPaisa: 590000,
    productCategorySnapshot: "eLearning",
    productNameSnapshot: "eLearning",
    productServiceId: "seed_product_elearning",
    quantity: 5,
    sortOrder: 0,
    unitPricePaisa: 100000
  },
  {
    id: "seed_proposal_line_video_shoot",
    description: "Scripted customer training video shoot.",
    gstRateBps: 1800,
    lineGstPaisa: 36000,
    lineSubtotalPaisa: 200000,
    lineTotalPaisa: 236000,
    productCategorySnapshot: "Video shoot",
    productNameSnapshot: "Video shoot",
    productServiceId: "seed_product_video_shoot",
    quantity: 1,
    sortOrder: 1,
    unitPricePaisa: 200000
  },
  {
    id: "seed_proposal_line_vr_ar",
    description: "VR scenario prototype for safety training.",
    gstRateBps: 1800,
    lineGstPaisa: 72000,
    lineSubtotalPaisa: 400000,
    lineTotalPaisa: 472000,
    productCategorySnapshot: "VR/AR",
    productNameSnapshot: "VR/AR",
    productServiceId: "seed_product_vr_ar",
    quantity: 1,
    sortOrder: 2,
    unitPricePaisa: 400000
  },
  {
    id: "seed_proposal_line_animation",
    description: "Animated explainer sequence.",
    gstRateBps: 1800,
    lineGstPaisa: 54000,
    lineSubtotalPaisa: 300000,
    lineTotalPaisa: 354000,
    productCategorySnapshot: "Animation",
    productNameSnapshot: "Animation",
    productServiceId: "seed_product_animation",
    quantity: 1,
    sortOrder: 3,
    unitPricePaisa: 300000
  }
] as const;

export const demoProposalTotals = {
  gstPaisa: demoProposalLineItems.reduce((total, item) => total + item.lineGstPaisa, 0),
  subtotalPaisa: demoProposalLineItems.reduce((total, item) => total + item.lineSubtotalPaisa, 0),
  totalPaisa: demoProposalLineItems.reduce((total, item) => total + item.lineTotalPaisa, 0)
} as const;

export const demoProductionWorkItems = [
  {
    id: "seed_work_elearning",
    dueAt: new Date("2026-07-03T00:00:00.000Z"),
    orderLineItemId: "seed_order_line_elearning",
    productCategorySnapshot: "eLearning",
    productNameSnapshot: "eLearning",
    productionTemplateId: "seed_production_template_elearning",
    productionTemplateKey: "elearning",
    proposalLineItemId: "seed_proposal_line_elearning",
    stageStatusByKey: { script: "DONE", storyboard: "IN_PROGRESS" },
    startedAt: new Date("2026-06-18T09:00:00.000Z"),
    status: "IN_PROGRESS",
    title: "eLearning production"
  },
  {
    id: "seed_work_video_shoot",
    dueAt: new Date("2026-07-08T00:00:00.000Z"),
    orderLineItemId: "seed_order_line_video_shoot",
    productCategorySnapshot: "Video shoot",
    productNameSnapshot: "Video shoot",
    productionTemplateId: "seed_production_template_video_shoot",
    productionTemplateKey: "video_shoot",
    proposalLineItemId: "seed_proposal_line_video_shoot",
    stageStatusByKey: { script: "DONE", pre_production: "IN_PROGRESS" },
    startedAt: new Date("2026-06-19T09:00:00.000Z"),
    status: "IN_PROGRESS",
    title: "Video shoot production"
  },
  {
    id: "seed_work_vr_ar",
    completedAt: new Date("2026-06-21T17:00:00.000Z"),
    dueAt: new Date("2026-07-12T00:00:00.000Z"),
    orderLineItemId: "seed_order_line_vr_ar",
    productCategorySnapshot: "VR/AR",
    productNameSnapshot: "VR/AR",
    productionTemplateId: "seed_production_template_vr_ar",
    productionTemplateKey: "vr_ar",
    proposalLineItemId: "seed_proposal_line_vr_ar",
    stageStatusByKey: { discovery: "DONE", design: "DONE", development: "DONE", testing: "DONE", review: "DONE", delivery: "DONE" },
    startedAt: new Date("2026-06-18T09:00:00.000Z"),
    status: "DONE",
    title: "VR/AR production"
  },
  {
    id: "seed_work_animation",
    dueAt: new Date("2026-07-15T00:00:00.000Z"),
    orderLineItemId: "seed_order_line_animation",
    productCategorySnapshot: "Animation",
    productNameSnapshot: "Animation",
    productionTemplateId: "seed_production_template_animation",
    productionTemplateKey: "animation",
    proposalLineItemId: "seed_proposal_line_animation",
    stageStatusByKey: {},
    status: "NOT_STARTED",
    title: "Animation production"
  }
] as const;
