import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
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
    findUnique: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<IdResult | LeadOwnerResult | null>;
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
    findUnique: (args: Prisma.ActivityFindUniqueArgs) => Promise<IdResult | null>;
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
    findUnique: (args: Prisma.LeadCustomerFindUniqueArgs) => Promise<LeadOwnerResult | null>;
    update: (args: Prisma.LeadCustomerUpdateArgs) => Promise<IdResult>;
  };
  leadOwnershipHistory: {
    create: (args: Prisma.LeadOwnershipHistoryCreateArgs) => Promise<IdResult>;
  };
  $transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
};

async function assertActiveOwner(database: OwnerDb, ownerId: string) {
  const owner = await database.user.findFirst({
    where: { id: ownerId, active: true, role: { in: ["ADMIN", "SALES"] } },
    select: { id: true }
  });

  if (!owner) {
    throw new Error("Choose an active Admin or Sales owner.");
  }
}

async function assertLeadExists(database: LeadLookupDb, leadCustomerId: string) {
  const lead = await database.leadCustomer.findUnique({
    where: { id: leadCustomerId },
    select: { id: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }
}

async function assertBranchBelongsToLead(database: CreateContactDb | CreateActivityDb, leadCustomerId: string, branchId: string) {
  const branch = await database.branch?.findFirst({
    where: { id: branchId, leadCustomerId },
    select: { id: true }
  });

  if (!branch) {
    throw new Error("Choose a branch that belongs to this lead or customer.");
  }
}

async function assertContactBelongsToLead(database: CreateActivityDb, leadCustomerId: string, contactId: string) {
  const contact = await database.contact?.findFirst({
    where: { id: contactId, leadCustomerId },
    select: { id: true }
  });

  if (!contact) {
    throw new Error("Choose a contact that belongs to this lead or customer.");
  }
}

export async function createLeadCustomer(
  user: CrmUser,
  input: LeadCustomerInput,
  database: CreateLeadDb = db as unknown as CreateLeadDb
) {
  assertCanWriteCrmRecords(user);
  await assertActiveOwner(database, input.ownerId);

  return database.leadCustomer.create({
    data: {
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
  database: UpdateLeadDb = db as unknown as UpdateLeadDb
) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, leadCustomerId);
  await assertActiveOwner(database, input.ownerId);

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
) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);

  return database.branch.create({ data: input });
}

export async function createContact(
  user: CrmUser,
  input: ContactInput,
  database: CreateContactDb = db as unknown as CreateContactDb
) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, input.leadCustomerId, input.branchId);
  }

  return database.contact.create({ data: input });
}

export async function createActivity(
  user: CrmUser,
  input: ActivityInput,
  database: CreateActivityDb = db as unknown as CreateActivityDb
) {
  assertCanWriteCrmRecords(user);
  await assertLeadExists(database, input.leadCustomerId);
  await assertActiveOwner(database, input.ownerId);

  if (input.branchId) {
    await assertBranchBelongsToLead(database, input.leadCustomerId, input.branchId);
  }

  if (input.contactId) {
    await assertContactBelongsToLead(database, input.leadCustomerId, input.contactId);
  }

  return database.activity.create({
    data: {
      ...input,
      createdById: user.id
    }
  });
}

export async function completeActivity(
  user: CrmUser,
  activityId: string,
  database: CompleteActivityDb = db as unknown as CompleteActivityDb
) {
  assertCanWriteCrmRecords(user);
  const activity = await database.activity.findUnique({
    where: { id: activityId },
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
  database: ReassignDb = db as unknown as ReassignDb
) {
  assertCanWriteCrmRecords(user);
  await assertActiveOwner(database, input.toOwnerId);

  const lead = await database.leadCustomer.findUnique({
    where: { id: input.leadCustomerId },
    select: { id: true, ownerId: true }
  });

  if (!lead) {
    throw new Error("Lead or customer was not found.");
  }

  if (lead.ownerId === input.toOwnerId) {
    throw new Error("Choose a different owner for reassignment.");
  }

  return database.$transaction(async (tx) => {
    const transaction = tx as ReassignTransactionDb;
    const updated = await transaction.leadCustomer.update({
      where: { id: input.leadCustomerId },
      data: { ownerId: input.toOwnerId, updatedById: user.id }
    });

    await transaction.leadOwnershipHistory.create({
      data: {
        leadCustomerId: input.leadCustomerId,
        fromOwnerId: lead.ownerId,
        toOwnerId: input.toOwnerId,
        changedById: user.id,
        reason: input.reason
      }
    });

    return updated;
  });
}
