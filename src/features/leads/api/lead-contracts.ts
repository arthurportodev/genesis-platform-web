import { z } from "zod";

import {
  inclusiveCivilDays,
  isUsableTimeZone,
  isValidCivilDate,
} from "@/features/leads/model/lead-metrics-period";

export const leadStatuses = ["active", "won", "lost", "archived"] as const;
export const leadStages = [
  "new",
  "qualification",
  "diagnosis",
  "proposal",
  "negotiation",
] as const;
export const leadSources = [
  "manual",
  "landing_page",
  "campaign",
  "lead_magnet",
  "other",
] as const;
export const leadNextActionStates = [
  "none",
  "overdue",
  "today",
  "future",
] as const;
export const leadSorts = [
  "createdAt:desc",
  "createdAt:asc",
  "nextActionDueAt:asc",
  "nextActionDueAt:desc",
] as const;
export const activityTypes = [
  "whatsapp",
  "call",
  "meeting",
  "diagnosis",
  "proposal_sent",
  "follow_up",
  "internal_task",
] as const;
export const nextActionTypes = [
  "whatsapp",
  "call",
  "meeting",
  "diagnosis",
  "send_proposal",
  "follow_up",
  "internal_task",
] as const;
export const lostReasons = [
  "not_qualified",
  "no_response",
  "no_budget",
  "not_now",
  "chose_competitor",
  "other",
] as const;
export const archiveReasons = [
  "duplicate",
  "spam",
  "test",
  "outdated",
  "other",
] as const;

const uuid = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const revision = z.string().regex(/^(0|[1-9]\d*)$/u);
const safeCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const civilDate = z
  .string()
  .refine(isValidCivilDate, "Data civil inválida.")
  .transform((value) => value);

export const nextActionSummarySchema = z.object({
  id: uuid,
  type: z.enum(nextActionTypes),
  description: z.string(),
  dueAt: timestamp,
  responsibleMembershipId: uuid.nullable(),
  status: z.enum(["pending", "completed", "canceled"]),
  revision,
});

export const leadListItemSchema = z.object({
  id: uuid,
  displayName: z.string().min(1),
  primaryPhone: z.string().min(1),
  email: z.email().nullable(),
  companyName: z.string().nullable(),
  responsibleMembershipId: uuid.nullable(),
  status: z.enum(leadStatuses),
  stage: z.enum(leadStages),
  source: z.string(),
  lastEntryAt: timestamp,
  nextAction: nextActionSummarySchema.nullable(),
  temporalState: z.enum(leadNextActionStates),
  returnPending: z.boolean(),
  revision,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const attributionSchema = z.object({
  source: z.string(),
  sourceDetail: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  utmContent: z.string().nullable(),
  utmTerm: z.string().nullable(),
  receivedAt: timestamp,
});

export const leadViewSchema = z.object({
  id: uuid,
  displayName: z.string().min(1),
  primaryPhone: z.string().min(1),
  email: z.email().nullable(),
  companyName: z.string().nullable(),
  instagram: z.string().nullable(),
  city: z.string().nullable(),
  serviceInterest: z.string().nullable(),
  responsibleMembershipId: uuid.nullable(),
  status: z.enum(leadStatuses),
  stage: z.enum(leadStages),
  latestCycleNumber: revision,
  returnReviewPending: z.boolean(),
  revision,
  createdAt: timestamp,
  updatedAt: timestamp,
  initialAttribution: attributionSchema,
  lastAttribution: attributionSchema,
  nextAction: nextActionSummarySchema.nullable(),
});

const optionalCreateText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();

export const createLeadInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    primaryPhone: z.string().trim().min(1).max(40),
    email: z.string().trim().toLowerCase().pipe(z.email().max(320)).optional(),
    companyName: optionalCreateText(160),
    instagram: optionalCreateText(64),
    city: optionalCreateText(120),
    serviceInterest: optionalCreateText(160),
    source: z.enum(leadSources).default("manual"),
    sourceDetail: optionalCreateText(120),
    utmSource: optionalCreateText(255),
    utmMedium: optionalCreateText(255),
    utmCampaign: optionalCreateText(255),
    utmContent: optionalCreateText(255),
    utmTerm: optionalCreateText(255),
    responsibleMembershipId: uuid.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.source === "other" && !input.sourceDetail) {
      context.addIssue({
        code: "custom",
        path: ["sourceDetail"],
        message: "Detalhe a outra origem.",
      });
    }
    if (input.source !== "other" && input.sourceDetail) {
      context.addIssue({
        code: "custom",
        path: ["sourceDetail"],
        message: "O detalhe só é permitido para outra origem.",
      });
    }
  });

const cycleSchema = z.object({
  id: uuid,
  cycleNumber: revision,
  openingReason: z.enum(["created", "reactivated"]),
  startingStage: z.enum(leadStages),
  openedByMembershipId: uuid.nullable(),
  openedAt: timestamp,
  closedByMembershipId: uuid.nullable(),
  closedAt: timestamp.nullable(),
  closingStatus: z.enum(["won", "lost", "archived"]).nullable(),
  stageAtClose: z.enum(leadStages).nullable(),
  lostReason: z.enum(lostReasons).nullable(),
  archiveReason: z.enum(archiveReasons).nullable(),
  reasonNote: z.string().nullable(),
});

export const leadDetailSchema = leadViewSchema.extend({
  latestEntry: z.object({
    id: uuid,
    sequence: revision,
    intakeChannel: z.string(),
    source: z.string(),
    receivedAt: timestamp,
  }),
  latestCycle: cycleSchema,
  pendingReturn: z
    .object({
      id: uuid,
      cycleId: uuid,
      entryCount: revision,
      openedAt: timestamp,
      updatedAt: timestamp,
    })
    .nullable(),
  counts: z.object({
    timeline: z.number().int().nonnegative(),
    cycles: z.number().int().nonnegative(),
    activities: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
  }),
});

const activitySchema = z.object({
  id: uuid,
  type: z.enum(activityTypes),
  performedAt: timestamp,
  recordedAt: timestamp,
  recordedByMembershipId: uuid,
  responsibleMembershipId: uuid.nullable(),
  outcome: z.string().nullable(),
  nextActionId: uuid.nullable(),
});

const noteSchema = z.object({
  id: uuid,
  content: z.string(),
  authorMembershipId: uuid,
  createdAt: timestamp,
});

export const timelineItemSchema = z.object({
  id: uuid,
  sequence: revision,
  eventType: z.string(),
  actorMembershipId: uuid.nullable(),
  leadEntryId: uuid.nullable(),
  previousResponsibleMembershipId: uuid.nullable(),
  newResponsibleMembershipId: uuid.nullable(),
  changedFields: z.array(z.string()).nullable(),
  cycleId: uuid.nullable(),
  returnReviewId: uuid.nullable(),
  previousStatus: z.enum(leadStatuses).nullable(),
  newStatus: z.enum(leadStatuses).nullable(),
  previousStage: z.enum(leadStages).nullable(),
  newStage: z.enum(leadStages).nullable(),
  lostReason: z.enum(lostReasons).nullable(),
  archiveReason: z.enum(archiveReasons).nullable(),
  activityId: uuid.nullable(),
  noteId: uuid.nullable(),
  nextActionId: uuid.nullable(),
  previousNextActionStatus: z
    .enum(["pending", "completed", "canceled"])
    .nullable(),
  newNextActionStatus: z.enum(["pending", "completed", "canceled"]).nullable(),
  previousDueAt: timestamp.nullable(),
  newDueAt: timestamp.nullable(),
  nextActionRevision: revision.nullable(),
  nextActionCancellationReason: z.enum(["manual", "lead_closed"]).nullable(),
  activity: activitySchema.nullable(),
  note: noteSchema.nullable(),
  nextAction: nextActionSummarySchema
    .extend({ cancellationNote: z.string().nullable() })
    .nullable(),
  occurredAt: timestamp,
});

export const leadListResponseSchema = z.object({
  items: z.array(leadListItemSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    asOf: timestamp,
  }),
});

const operationalPageSchema = z.object({
  nextCursor: z.string().min(1).max(512).nullable(),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  asOf: timestamp,
});

export const leadWorkItemSchema = leadListItemSchema.transform((lead) => ({
  id: lead.id,
  displayName: lead.displayName,
  companyName: lead.companyName,
  responsibleMembershipId: lead.responsibleMembershipId,
  status: lead.status,
  stage: lead.stage,
  source: lead.source,
  lastEntryAt: lead.lastEntryAt,
  nextAction: lead.nextAction,
  temporalState: lead.temporalState,
  returnPending: lead.returnPending,
  revision: lead.revision,
  createdAt: lead.createdAt,
  updatedAt: lead.updatedAt,
}));

export const leadWorkListResponseSchema = z.object({
  items: z.array(leadWorkItemSchema),
  page: operationalPageSchema,
});

export const leadReturnReviewQueueResponseSchema = z.object({
  items: z.array(
    z.object({
      lead: leadWorkItemSchema,
      review: z.object({
        id: uuid,
        cycleId: uuid,
        entryCount: revision,
        openedAt: timestamp,
        updatedAt: timestamp,
        firstEntry: z.object({
          id: uuid,
          source: z.string(),
          receivedAt: timestamp,
        }),
        latestEntry: z.object({
          id: uuid,
          source: z.string(),
          receivedAt: timestamp,
        }),
      }),
    }),
  ),
  page: operationalPageSchema,
});

export const leadKanbanColumnSchema = z
  .object({
    stage: z.enum(leadStages),
    total: z.number().int().nonnegative(),
    items: z.array(leadListItemSchema),
    page: z.object({
      nextCursor: z.string().min(1).max(512).nullable(),
      limit: z.number().int().min(1).max(20),
    }),
  })
  .superRefine((column, context) => {
    for (const [index, item] of column.items.entries()) {
      if (item.stage !== column.stage) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "stage"],
          message: "O Lead não pertence à coluna informada.",
        });
      }
      if (item.status !== "active") {
        context.addIssue({
          code: "custom",
          path: ["items", index, "status"],
          message: "O Kanban aceita somente Leads ativos.",
        });
      }
    }
  });

export const leadKanbanResponseSchema = z
  .object({
    columns: z.array(leadKanbanColumnSchema).min(1).max(5),
    asOf: timestamp,
  })
  .superRefine((response, context) => {
    const stages = response.columns.map(({ stage }) => stage);
    if (new Set(stages).size !== stages.length) {
      context.addIssue({
        code: "custom",
        path: ["columns"],
        message: "O Kanban retornou uma etapa duplicada.",
      });
    }
    const ordered = stages.every(
      (stage, index) =>
        index === 0 ||
        leadStages.indexOf(stage) > leadStages.indexOf(stages[index - 1]),
    );
    if (!ordered) {
      context.addIssue({
        code: "custom",
        path: ["columns"],
        message: "As colunas do Kanban estão fora da ordem canônica.",
      });
    }
  });

export const timelineResponseSchema = z.object({
  items: z.array(timelineItemSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    limit: z.number().int().positive(),
  }),
});

export const nextActionResponseSchema = z.object({
  item: nextActionSummarySchema
    .extend({
      temporalState: z.enum(["overdue", "today", "future"]),
      cycleId: uuid,
      createdByMembershipId: uuid,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .nullable(),
  temporalState: z.enum(leadNextActionStates),
  leadRevision: revision,
});

export const cyclesResponseSchema = z.object({
  items: z.array(cycleSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    limit: z.number().int().positive(),
  }),
});

export const memberSchema = z.object({
  id: uuid,
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(["owner", "admin", "member"]),
  status: z.enum(["active", "inactive"]),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const membersResponseSchema = z.object({
  items: z.array(memberSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    limit: z.number().int().positive(),
  }),
});

export const leadMetricsSummarySchema = z
  .object({
    asOf: timestamp,
    timeZone: z.string().min(1).max(64).refine(isUsableTimeZone),
    snapshot: z.object({
      active: safeCount,
      unassigned: safeCount,
      overdue: safeCount,
      withoutNextAction: safeCount,
      pendingReturns: safeCount,
    }),
    period: z.object({
      from: civilDate,
      to: civilDate,
      created: safeCount,
      won: safeCount,
      lost: safeCount,
      createdBySource: z
        .array(
          z.object({
            source: z.string().min(1).max(32),
            count: safeCount.positive(),
          }),
        )
        .max(64),
    }),
  })
  .superRefine((summary, context) => {
    const validPeriod =
      isValidCivilDate(summary.period.from) &&
      isValidCivilDate(summary.period.to);
    const days = validPeriod
      ? inclusiveCivilDays(summary.period.from, summary.period.to)
      : 0;
    if (validPeriod && (days < 1 || days > 366)) {
      context.addIssue({
        code: "custom",
        path: ["period"],
        message: "O período retornado é inválido.",
      });
    }
    const sources = summary.period.createdBySource.map(({ source }) => source);
    if (new Set(sources).size !== sources.length) {
      context.addIssue({
        code: "custom",
        path: ["period", "createdBySource"],
        message: "A resposta contém uma origem duplicada.",
      });
    }
    const sourceTotal = summary.period.createdBySource.reduce(
      (total, source) => total + source.count,
      0,
    );
    if (sourceTotal !== summary.period.created) {
      context.addIssue({
        code: "custom",
        path: ["period", "createdBySource"],
        message: "A distribuição por origem não corresponde aos Leads criados.",
      });
    }
  });

export const mutationCreatedSchema = z.object({ id: uuid });

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadStage = (typeof leadStages)[number];
export type LeadSource = (typeof leadSources)[number];
export type LeadNextActionState = (typeof leadNextActionStates)[number];
export type LeadSort = (typeof leadSorts)[number];
export type ActivityType = (typeof activityTypes)[number];
export type NextActionType = (typeof nextActionTypes)[number];
export type LostReason = (typeof lostReasons)[number];
export type ArchiveReason = (typeof archiveReasons)[number];
export type LeadListItem = z.infer<typeof leadListItemSchema>;
export type LeadListResponse = z.infer<typeof leadListResponseSchema>;
export type LeadWorkItem = z.infer<typeof leadWorkItemSchema>;
export type LeadWorkListResponse = z.infer<typeof leadWorkListResponseSchema>;
export type LeadReturnReviewItem = z.infer<
  typeof leadReturnReviewQueueResponseSchema
>["items"][number];
export type LeadReturnReviewQueueResponse = z.infer<
  typeof leadReturnReviewQueueResponseSchema
>;
export type LeadNextActionSummary = z.infer<typeof nextActionSummarySchema>;
export type LeadKanbanColumn = z.infer<typeof leadKanbanColumnSchema>;
export type LeadKanbanResponse = z.infer<typeof leadKanbanResponseSchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export type LeadView = z.infer<typeof leadViewSchema>;
export type CreateLeadInput = z.output<typeof createLeadInputSchema>;
export type CreateLeadResult =
  | {
      kind: "identified";
      status: 200 | 201;
      lead: LeadView;
      etag: string;
      location: string | null;
      replayed: boolean;
    }
  | { kind: "opaque"; status: 204; replayed: boolean };
export type TimelineItem = z.infer<typeof timelineItemSchema>;
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;
export type NextActionResponse = z.infer<typeof nextActionResponseSchema>;
export type CyclesResponse = z.infer<typeof cyclesResponseSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MembersResponse = z.infer<typeof membersResponseSchema>;
export type LeadMetricsSummary = z.infer<typeof leadMetricsSummarySchema>;

export interface LeadListFilters {
  q?: string;
  status: LeadStatus;
  stage?: LeadStage;
  source?: LeadSource;
  responsibleMembershipId?: string;
  assignedToMe?: boolean;
  unassigned?: boolean;
  nextActionState?: LeadNextActionState;
  returnPending?: boolean;
  createdFrom?: string;
  createdTo?: string;
  lastEntryFrom?: string;
  lastEntryTo?: string;
  sort: LeadSort;
  limit: number;
}

export interface LeadKanbanFilters {
  q?: string;
  source?: LeadSource;
  responsibleMembershipId?: string;
  assignedToMe?: boolean;
  unassigned?: boolean;
  nextActionState?: LeadNextActionState;
  createdFrom?: string;
  createdTo?: string;
  lastEntryFrom?: string;
  lastEntryTo?: string;
  limit: number;
}

export type LeadMyActionState = Exclude<LeadNextActionState, "none">;

export interface LeadMyActionsFilters {
  responsibleMembershipId?: string;
  state?: LeadMyActionState;
  limit: number;
}

export interface LeadUnassignedFilters {
  q?: string;
  status: LeadStatus;
  source?: LeadSource;
  nextActionState?: LeadNextActionState;
  createdFrom?: string;
  createdTo?: string;
  lastEntryFrom?: string;
  lastEntryTo?: string;
  limit: number;
}

export interface LeadReturnReviewFilters {
  q?: string;
  source?: LeadSource;
  limit: number;
}

export interface UpdateLeadInput {
  displayName?: string;
  primaryPhone?: string;
  email?: string | null;
  companyName?: string | null;
  instagram?: string | null;
  city?: string | null;
  serviceInterest?: string | null;
}
