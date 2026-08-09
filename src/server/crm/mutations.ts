import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { withOrganization } from "@/server/organizations/with-organization";
import { assertOrganizationUserEligible } from "@/server/organizations/member-options";
import { assertCanWriteCrmRecords, type CrmUser } from "./permissions";
import type { ActivityInput, BranchInput, ContactInput, LeadCustomerInput, ReassignmentInput } from "./types";

type IdResult = { id: string };
type LeadOwnerResult = { id: string; ownerId: string };

type OwnerDb = {
  user: {
    findFirst: (args: Prisma.UserFindFirstArgs) => Promise<IdResult | null>;
  };
};

type LeadLookupDb = {
  leadCustomer: {
    findFirst?: (args: Prisma.LeadCustomerFindFirstArgs) => Promise<IdResult | LeadOwnerResult | null>;
    findUnique?: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<IdResult | LeadOwnerResult | null>;
  };
};

type CreateLeadDb = OwnerDb & {
  leadCustomer: {
    create: (args: Prisma.LeadCustomerCreateArgs) => Promise<IdResult>;
  };
};

type UpdateLeadDb = OwnerDb &
  LeadLookupDb & {
    leadCustomer: LeadLookupDb["leadCustomer"] & {
      update: (args: Prisma.LeadCustomerUpdateArgs) => Promise<IdResult>;
    };
  };

type CreateBranchDb = LeadLookupDb & {
  branch: {
    create: (args: Prisma.BranchCreateArgs) => Promise<IdResult>;
  };
};

type CreateContactDb = LeadLookupDb & {
  branch?: {
    findFirst: (args: Prisma.BranchFindFirstArgs) => Promise<IdResult | null>;
  };
  contact: {
    create: (args: Prisma.ContactCreateArgs) => Promise<IdResult>;
  };
};

type CreateActivityDb = OwnerDb &
  LeadLookupDb & {
    branch?: {
      findFirst: (args: Prisma.BranchFindFirstArgs) => Promise<IdResult | null>;
    };
    contact?: {
      findFirst: (args: Prisma.ContactFindFirstArgs) => Promise<IdResult | null>;
    };
    activity: {
      create: (args: Prisma.ActivityCreateArgs) => Promise<IdResult>;
    };
  };

type CompleteActivityDb = {
  activity: {
    findFirst?: (args: Prisma.ActivityFindFirstArgs) => Promise<IdResult | null>;
    findUnique?: (args: Prisma.ActivityFindUniqueArgs) => Promise<IdResult | null>;
    update: (args: Prisma.ActivityUpdateArgs) => Promise<IdResult>;
  };
};

type ReassignTransactionDb = {
  leadCustomer: {
    update: (args: Prisma.LeadCustomerUpdateArgs) => Promise<IdResult>;
  };
  leadOwnershipHistory: {
    create: (args: Prisma.LeadOwnershipHistoryCreateArgs) => Promise<IdResult>;
  };
};

type ReassignDb = OwnerDb & {
  leadCustomer: {
    findFirst?: (args: Prisma.LeadCustomerFindFirstArgs) => Promise<LeadOwnerResult | null>;
    findUnique?: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<LeadOwnerResult | null>;
    update: (args: Prisma.LeadCustomerUpdateArgs) => Promise<IdResult>;
  };
  leadOwnershipHistory: {
    create: (args: Prisma.LeadOwnershipHistoryCreateArgs) => Promise<IdResult>;
  };
  $transaction?: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

async function assertActiveOwner(database: OwnerDb, organizationId: string, ownerId: string) {
  const owner = await database.user.findFirst({
    where: { id: ownerId, active: true, role: { in: ["ADMIN", "SALES"] }, memberships: { some: { organizationId, status: "ACTIVE" } } },
    select: { id: true }
  });

  if (!owner) {
    throw new Error("Choose an active Admin or Sales owner.");
  }
}

async function assertLeadExists(database: LeadLookupDb, organizationId: string, leadCustomerId: string) {
  const lead = await (database.leadCustomer.findFirst ?? database.leadCustomer.findUnique!)({
    where: { id: leadCustomerId, organizationId },
    select: { id: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }
}

async function assertBranchBelongsToLead(database: CreateContactDb | CreateActivityDb, organizationId: string, leadCustomerId: string, branchId: string) {
  const branch = await database.branch?.findFirst({
    where: { id: branchId, leadCustomerId, organizationId },
    select: { id: true }
  });

  if (!branch) {
    throw new Error("Choose a branch that belongs to this lead or customer.");
  }
}

async function assertContactBelongsToLead(database: CreateActivityDb, organizationId: string, leadCustomerId: string, contactId: string) {
  const contact = await database.contact?.findFirst({
    where: { id: contactId, leadCustomerId, organizationId },
    select: { id: true }
  });

  if (!contact) {
    throw new Error("Choose a contact that belongs to this lead or customer.");
  }
}

export async function createLeadCustomer(
  user: CrmUser,
  input: LeadCustomerInput,
  database: CreateLeadDb = db as unknown as CreateLeadDb,
  ownerVerified = false
): Promise<IdResult> {
  if (database === (db as unknown as CreateLeadDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => createLeadCustomer(user, input, tx as unknown as CreateLeadDb, true));
  }
  assertCanWriteCrmRecords(user);
  if (!ownerVerified) await assertActiveOwner(database, user.organizationId, input.ownerId);

  return database.leadCustomer.create({
    data: {
      organizationId: user.organizationId,
      name: input.name,
      state: input.state,
      industry: input.industry,
      source: input.source,
      ownerId: input.ownerId,
      notes: input.notes,
      createdById: user.id,
      updatedById: user.id
    }
  });
}

export async function updateLeadCustomer(
  user: CrmUser,
  leadCustomerId: string,
  input: LeadCustomerInput,
  database: UpdateLeadDb = db as unknown as UpdateLeadDb,
  ownerVerified = false
): Promise<IdResult> {
  if (database === (db as unknown as UpdateLeadDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => updateLeadCustomer(user, leadCustomerId, input, tx as unknown as UpdateLeadDb, true));
  }
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, user.organizationId, leadCustomerId);
  if (!ownerVerified) await assertActiveOwner(database, user.organizationId, input.ownerId);

  return database.leadCustomer.update({
    where: { id: leadCustomerId },
    data: {
      name: input.name,
      state: input.state,
      industry: input.industry,
      source: input.source,
      ownerId: input.ownerId,
      notes: input.notes,
      updatedById: user.id
    }
  });
}

export async function createBranch(
  user: CrmUser,
  input: BranchInput,
  database: CreateBranchDb = db as unknown as CreateBranchDb
): Promise<IdResult> {
  if (database === (db as unknown as CreateBranchDb)) return withOrganization(user.organizationId, (tx) => createBranch(user, input, tx as unknown as CreateBranchDb));
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, user.organizationId, input.leadCustomerId);

  return database.branch.create({ data: { ...input, organizationId: user.organizationId } });
}

export async function createContact(
  user: CrmUser,
  input: ContactInput,
  database: CreateContactDb = db as unknown as CreateContactDb
): Promise<IdResult> {
  if (database === (db as unknown as CreateContactDb)) return withOrganization(user.organizationId, (tx) => createContact(user, input, tx as unknown as CreateContactDb));
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, user.organizationId, input.leadCustomerId);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, user.organizationId, input.leadCustomerId, input.branchId);
  }

  return database.contact.create({ data: { ...input, organizationId: user.organizationId } });
}

export async function createActivity(
  user: CrmUser,
  input: ActivityInput,
  database: CreateActivityDb = db as unknown as CreateActivityDb,
  ownerVerified = false
): Promise<IdResult> {
  if (database === (db as unknown as CreateActivityDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.ownerId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => createActivity(user, input, tx as unknown as CreateActivityDb, true));
  }
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, user.organizationId, input.leadCustomerId);
  if (!ownerVerified) await assertActiveOwner(database, user.organizationId, input.ownerId);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, user.organizationId, input.leadCustomerId, input.branchId);
  }

  if (input.contactId) {
    await assertContactBelongsToLead(database, user.organizationId, input.leadCustomerId, input.contactId);
  }

  return database.activity.create({
    data: {
      organizationId: user.organizationId,
      ...input,
      createdById: user.id
    }
  });
}

export async function completeActivity(
  user: CrmUser,
  activityId: string,
  database: CompleteActivityDb = db as unknown as CompleteActivityDb
): Promise<IdResult> {
  if (database === (db as unknown as CompleteActivityDb)) return withOrganization(user.organizationId, (tx) => completeActivity(user, activityId, tx as unknown as CompleteActivityDb));
  assertCanWriteCrmRecords(user);
  const activity = await (database.activity.findFirst ?? database.activity.findUnique!)({
    where: { id: activityId, organizationId: user.organizationId },
    select: { id: true }
  });

  if (!activity) {
    throw new Error("Activity was not found.");
  }

  return database.activity.update({
    where: { id: activityId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: user.id
    }
  });
}

export async function reassignLeadOwner(
  user: CrmUser,
  input: ReassignmentInput,
  database: ReassignDb = db as unknown as ReassignDb,
  ownerVerified = false
): Promise<unknown> {
  if (database === (db as unknown as ReassignDb)) {
    await assertOrganizationUserEligible(user.organizationId, input.toOwnerId, ["ADMIN", "SALES"]);
    return withOrganization(user.organizationId, (tx) => reassignLeadOwner(user, input, tx as unknown as ReassignDb, true));
  }
  assertCanWriteCrmRecords(user);
  if (!ownerVerified) await assertActiveOwner(database, user.organizationId, input.toOwnerId);

  const lead = await (database.leadCustomer.findFirst ?? database.leadCustomer.findUnique!)({
    where: { id: input.leadCustomerId, organizationId: user.organizationId },
    select: { id: true, ownerId: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }

  if (lead.ownerId === input.toOwnerId) {
    throw new Error("Choose a different owner for reassignment.");
  }

  const applyReassignment = async (tx: unknown) => {
    const transaction = tx as ReassignTransactionDb;
    const updated = await transaction.leadCustomer.update({
      where: { id: input.leadCustomerId },
      data: { ownerId: input.toOwnerId, updatedById: user.id }
    });

    await transaction.leadOwnershipHistory.create({
      data: {
        organizationId: user.organizationId,
        leadCustomerId: input.leadCustomerId,
        fromOwnerId: lead.ownerId,
        toOwnerId: input.toOwnerId,
        changedById: user.id,
        reason: input.reason
      }
    });

    return updated;
  };

  return database.$transaction ? database.$transaction(applyReassignment) : applyReassignment(database);
}
