export type TenantSeedKey = "ara-global" | "ai-consulting";

export type TenantSeedUser = {
  name: string;
  email: string;
  role: "ADMIN" | "SALES";
};

export type TenantSeedFixture = {
  cellId: string;
  cellKey: TenantSeedKey;
  displayName: string;
  planCode: string;
  enabledModules: string[];
  allowedModules: string[];
  users: readonly TenantSeedUser[];
  demoLeadCustomers: readonly TenantSeedDemoLeadCustomer[];
};

const demoModules = ["crm", "opportunities", "proposals", "orders", "production", "finance", "reports"];

export type TenantSeedDemoLeadCustomer = {
  id: string;
  name: string;
  state: "LEAD" | "CUSTOMER";
  industry: string;
  source: string;
  ownerEmail: string;
  notes: string;
  branch: {
    id: string;
    name: string;
    city: string;
    region: string;
    salesContext: string;
  };
  contact: {
    id: string;
    name: string;
    designation: string;
    email: string;
    phone: string;
  };
  activity: {
    id: string;
    subject: string;
    type: "CALL" | "EMAIL" | "MEETING" | "FOLLOW_UP";
    dueAt: string;
  };
  salesTarget: {
    financialYear: number;
    quarter: number;
    targetValueInr: string;
  };
};

export const tenantSeedFixtures: Record<TenantSeedKey, TenantSeedFixture> = {
  "ara-global": {
    cellId: "cell_ara_global",
    cellKey: "ara-global",
    displayName: "ARA Global",
    planCode: "ENTERPRISE",
    enabledModules: demoModules,
    allowedModules: demoModules,
    users: [
      { name: "Karthik ARA Global", email: "karthik@ara-global.demo.local", role: "ADMIN" },
      { name: "Yamini ARA Global", email: "yamini@ara-global.demo.local", role: "SALES" },
      { name: "Padma ARA Global", email: "padma@ara-global.demo.local", role: "SALES" },
      { name: "Atchaya ARA Global", email: "atchaya@ara-global.demo.local", role: "SALES" }
    ],
    demoLeadCustomers: [
      {
        id: "ara_lead_orion_learning",
        name: "Orion Learning Systems",
        state: "LEAD",
        industry: "Education",
        source: "Referral",
        ownerEmail: "yamini@ara-global.demo.local",
        notes: "Yamini is qualifying a blended learning rollout for a regional training team.",
        branch: { id: "ara_branch_orion_chennai", name: "Chennai Learning Office", city: "Chennai", region: "Tamil Nadu", salesContext: "Training operations and LMS adoption" },
        contact: { id: "ara_contact_orion_meena", name: "Meena Krishnan", designation: "Head of Training", email: "meena.krishnan@orion-learning.example", phone: "+91 90000 10001" },
        activity: { id: "ara_activity_orion_followup", subject: "Follow up on blended learning rollout", type: "FOLLOW_UP", dueAt: "2026-09-15T10:00:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "1250000.00" }
      },
      {
        id: "ara_lead_summit_healthcare",
        name: "Summit Healthcare Academy",
        state: "CUSTOMER",
        industry: "Healthcare",
        source: "Existing account",
        ownerEmail: "padma@ara-global.demo.local",
        notes: "Padma owns the healthcare renewal and expansion conversation.",
        branch: { id: "ara_branch_summit_bengaluru", name: "Bengaluru Operations", city: "Bengaluru", region: "Karnataka", salesContext: "Compliance learning and onboarding stakeholders" },
        contact: { id: "ara_contact_summit_latha", name: "Latha Nair", designation: "Director of People Operations", email: "latha.nair@summit-healthcare.example", phone: "+91 90000 10002" },
        activity: { id: "ara_activity_summit_review", subject: "Review compliance renewal scope", type: "MEETING", dueAt: "2026-09-16T11:00:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "1100000.00" }
      },
      {
        id: "ara_lead_nova_industries",
        name: "Nova Industries Safety",
        state: "LEAD",
        industry: "Manufacturing",
        source: "Web inquiry",
        ownerEmail: "atchaya@ara-global.demo.local",
        notes: "Atchaya is exploring a safety induction video and microlearning package.",
        branch: { id: "ara_branch_nova_coimbatore", name: "Coimbatore Plant", city: "Coimbatore", region: "Tamil Nadu", salesContext: "Plant safety, induction, and contractor training" },
        contact: { id: "ara_contact_nova_revathi", name: "Revathi S", designation: "EHS Manager", email: "revathi.s@nova-industries.example", phone: "+91 90000 10003" },
        activity: { id: "ara_activity_nova_call", subject: "Schedule safety induction discovery call", type: "CALL", dueAt: "2026-09-17T09:30:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "950000.00" }
      },
      {
        id: "ara_lead_vertex_enterprise",
        name: "Vertex Enterprise Learning",
        state: "CUSTOMER",
        industry: "Professional Services",
        source: "Leadership relationship",
        ownerEmail: "karthik@ara-global.demo.local",
        notes: "Karthik is admin but also directly owns this strategic client relationship.",
        branch: { id: "ara_branch_vertex_mumbai", name: "Mumbai Corporate Office", city: "Mumbai", region: "Maharashtra", salesContext: "Executive sponsor relationship and cross-sell planning" },
        contact: { id: "ara_contact_vertex_sanjay", name: "Sanjay Deshmukh", designation: "Chief Operating Officer", email: "sanjay.deshmukh@vertex-learning.example", phone: "+91 90000 10004" },
        activity: { id: "ara_activity_vertex_email", subject: "Send strategic account proposal outline", type: "EMAIL", dueAt: "2026-09-18T12:00:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "1500000.00" }
      }
    ]
  },
  "ai-consulting": {
    cellId: "cell_ai_consulting",
    cellKey: "ai-consulting",
    displayName: "AI Consulting",
    planCode: "ENTERPRISE",
    enabledModules: demoModules,
    allowedModules: demoModules,
    users: [
      { name: "Karthik AI Consulting", email: "karthik@ai-consulting.demo.local", role: "ADMIN" },
      { name: "Aishwarya AI Consulting", email: "aishwarya@ai-consulting.demo.local", role: "SALES" }
    ],
    demoLeadCustomers: [
      {
        id: "aic_lead_bluepeak_ai",
        name: "BluePeak AI Readiness",
        state: "LEAD",
        industry: "Technology",
        source: "Founder network",
        ownerEmail: "aishwarya@ai-consulting.demo.local",
        notes: "Aishwarya is qualifying an AI workflow assessment and enablement sprint.",
        branch: { id: "aic_branch_bluepeak_remote", name: "Remote Strategy Team", city: "Bengaluru", region: "Karnataka", salesContext: "AI readiness, process mining, and enablement planning" },
        contact: { id: "aic_contact_bluepeak_nisha", name: "Nisha Varma", designation: "Chief Product Officer", email: "nisha.varma@bluepeak-ai.example", phone: "+91 91000 20001" },
        activity: { id: "aic_activity_bluepeak_discovery", subject: "Run AI readiness discovery call", type: "MEETING", dueAt: "2026-09-15T14:00:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "800000.00" }
      },
      {
        id: "aic_lead_crescent_ops",
        name: "Crescent Operations Advisory",
        state: "CUSTOMER",
        industry: "Consulting",
        source: "Existing advisory client",
        ownerEmail: "karthik@ai-consulting.demo.local",
        notes: "This Karthik is the AI Consulting admin and owns a separate demo client in this cell.",
        branch: { id: "aic_branch_crescent_hyderabad", name: "Hyderabad Delivery Hub", city: "Hyderabad", region: "Telangana", salesContext: "Automation roadmap and executive reporting" },
        contact: { id: "aic_contact_crescent_rohan", name: "Rohan Iyer", designation: "Managing Partner", email: "rohan.iyer@crescent-ops.example", phone: "+91 91000 20002" },
        activity: { id: "aic_activity_crescent_roadmap", subject: "Share automation roadmap proposal", type: "EMAIL", dueAt: "2026-09-16T15:30:00.000Z" },
        salesTarget: { financialYear: 2026, quarter: 3, targetValueInr: "1200000.00" }
      }
    ]
  }
};
