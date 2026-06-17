import type {
  SalesDayReviewItemStatus,
  SalesSuggestedActionStatus,
  SalesTaskPriority,
  SalesTaskSource,
  SalesTaskStatus,
  SalesTaskType,
  SalesVoiceNoteStatus
} from "@prisma/client";

export type SalesDayActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type MyDayLinkedRecord = {
  id: string;
  label: string;
};

export type MyDaySuggestedActionRecord = {
  id: string;
  title: string;
  description?: string | null;
  type: SalesTaskType;
  suggestedDueAt?: Date | null;
  status: SalesSuggestedActionStatus;
  confidenceLabel?: string | null;
};

export type MyDayVoiceNoteRecord = {
  id: string;
  taskId?: string | null;
  status: SalesVoiceNoteStatus;
  audioUrl: string;
  transcript?: string | null;
  summary?: string | null;
  customerAsk?: string | null;
  nextStep?: string | null;
  processingError?: string | null;
  createdAt: Date;
  actions: MyDaySuggestedActionRecord[];
};

export type MyDayTaskRecord = {
  id: string;
  title: string;
  description?: string | null;
  type: SalesTaskType;
  priority: SalesTaskPriority;
  status: SalesTaskStatus;
  source: SalesTaskSource;
  dueAt?: Date | null;
  completedAt?: Date | null;
  leadCustomer?: MyDayLinkedRecord | null;
  opportunity?: MyDayLinkedRecord | null;
  proposal?: MyDayLinkedRecord | null;
  order?: MyDayLinkedRecord | null;
  voiceNotes: MyDayVoiceNoteRecord[];
};

export type MyDayViewModel = {
  date: Date;
  openTasks: MyDayTaskRecord[];
  overdueTasks: MyDayTaskRecord[];
  completedTasks: MyDayTaskRecord[];
  cancelledTasks: MyDayTaskRecord[];
  voiceNotes: MyDayVoiceNoteRecord[];
};

export type MyDayInsightItem = {
  id: string;
  title: string;
  detail: string;
  linkedRecord?: MyDayLinkedRecord | null;
};

export type MyDayInsightsViewModel = {
  suggestedTomorrowTasks: MyDayInsightItem[];
  accountsNeedingAttention: MyDayInsightItem[];
  voiceNoteSummaries: MyDayInsightItem[];
  carryForwardTasks: MyDayTaskRecord[];
};

export type EndOfDayReviewItemInput = {
  taskId: string;
  status: SalesDayReviewItemStatus;
  note?: string;
};
