import { z, type ZodType } from "zod";

import {
  cyclesResponseSchema,
  leadStages,
  leadDetailSchema,
  leadKanbanResponseSchema,
  leadListResponseSchema,
  leadViewSchema,
  membersResponseSchema,
  mutationCreatedSchema,
  nextActionResponseSchema,
  timelineResponseSchema,
  type ActivityType,
  type ArchiveReason,
  type LeadDetail,
  type LeadKanbanFilters,
  type LeadListFilters,
  type LeadStage,
  type LostReason,
  type NextActionType,
  type UpdateLeadInput,
} from "@/features/leads/api/lead-contracts";
import {
  buildLeadKanbanPath,
  buildLeadListPath,
} from "@/features/leads/api/lead-filters";
import {
  assertCurrentLeadSnapshot,
  createLeadSnapshot,
  type LeadSnapshot,
} from "@/features/leads/api/lead-snapshot";
import type {
  AuthenticatedHttpClient,
  HttpResponse,
} from "@/shared/api/contracts";
import { AppError } from "@/shared/api/errors";
import type { IdempotencyKey } from "@/shared/api/idempotency";

const leadIdSchema = z.uuid();

function leadPath(leadId: string, suffix = ""): string {
  return `/api/v1/leads/${leadIdSchema.parse(leadId)}${suffix}`;
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      "protocol",
      "A API retornou um contrato de Lead inválido.",
    );
  return result.data;
}

function requireEtag(response: Pick<HttpResponse<unknown>, "etag">): string {
  if (!response.etag || response.etag === "*")
    throw new AppError("protocol", "A API não retornou o ETag do Lead.");
  return response.etag;
}

export interface LeadDetailSnapshot {
  lead: LeadDetail;
  snapshot: LeadSnapshot;
}

export interface MutationReceipt {
  etag: string;
  replayed: boolean;
}

export type LeadIdempotentAction =
  | {
      action: "activity";
      body: { type: ActivityType; performedAt: string; outcome?: string };
    }
  | { action: "note"; body: { content: string } }
  | {
      action: "next-action-create";
      body: { type: NextActionType; description: string; dueAt: string };
    }
  | { action: "next-action-reschedule"; body: { dueAt: string } }
  | {
      action: "next-action-complete";
      body: { performedAt: string; outcome?: string };
    }
  | { action: "next-action-cancel"; body: { note?: string } }
  | { action: "move"; body: { stage: LeadStage } }
  | { action: "win"; body: Record<string, never> }
  | {
      action: "lose";
      body: { lostReason: LostReason; reasonNote?: string };
    }
  | {
      action: "archive";
      body: { archiveReason: ArchiveReason; reasonNote?: string };
    }
  | { action: "reactivate"; body: Record<string, never> }
  | { action: "dismiss-return"; body: Record<string, never> };

const actionSuffix: Record<LeadIdempotentAction["action"], string> = {
  activity: "/activities",
  note: "/notes",
  "next-action-create": "/next-action",
  "next-action-reschedule": "/next-action/reschedule",
  "next-action-complete": "/next-action/complete",
  "next-action-cancel": "/next-action/cancel",
  move: "/move",
  win: "/win",
  lose: "/lose",
  archive: "/archive",
  reactivate: "/reactivate",
  "dismiss-return": "/return-review/dismiss",
};

export function createLeadApi(http: AuthenticatedHttpClient) {
  return {
    async list(
      filters: LeadListFilters,
      cursor?: string,
      signal?: AbortSignal,
    ) {
      const response = await http.request(buildLeadListPath(filters, cursor), {
        kind: "tenant-scoped",
        method: "GET",
        signal,
      });
      return parse(leadListResponseSchema, response.data);
    },

    async kanban(
      filters: LeadKanbanFilters,
      page: { stage?: LeadStage; cursor?: string } = {},
      signal?: AbortSignal,
    ) {
      const response = await http.request(buildLeadKanbanPath(filters, page), {
        kind: "tenant-scoped",
        method: "GET",
        signal,
      });
      const board = parse(leadKanbanResponseSchema, response.data);
      if (page.stage) {
        if (
          board.columns.length !== 1 ||
          board.columns[0]?.stage !== page.stage
        )
          throw new AppError(
            "protocol",
            "A API retornou uma coluna de Kanban inesperada.",
          );
      } else if (
        board.columns.length !== 5 ||
        !leadStages.every(
          (stage, index) => board.columns[index]?.stage === stage,
        )
      ) {
        throw new AppError(
          "protocol",
          "A API não retornou as cinco colunas canônicas do Kanban.",
        );
      }
      return board;
    },

    async detail(
      leadId: string,
      signal?: AbortSignal,
    ): Promise<LeadDetailSnapshot> {
      const response = await http.request(leadPath(leadId), {
        kind: "tenant-scoped",
        method: "GET",
        signal,
      });
      const lead = parse(leadDetailSchema, response.data);
      return {
        lead,
        snapshot: createLeadSnapshot(
          requireEtag(response),
          lead.id,
          lead.revision,
        ),
      };
    },

    async timeline(leadId: string, cursor?: string, signal?: AbortSignal) {
      const search = new URLSearchParams({ limit: "50" });
      if (cursor) search.set("cursor", cursor);
      const response = await http.request(
        `${leadPath(leadId, "/timeline")}?${search.toString()}`,
        { kind: "tenant-scoped", method: "GET", signal },
      );
      return parse(timelineResponseSchema, response.data);
    },

    async nextAction(leadId: string, signal?: AbortSignal) {
      const response = await http.request(leadPath(leadId, "/next-action"), {
        kind: "tenant-scoped",
        method: "GET",
        signal,
      });
      return parse(nextActionResponseSchema, response.data);
    },

    async cycles(leadId: string, cursor?: string, signal?: AbortSignal) {
      const search = new URLSearchParams({ limit: "25" });
      if (cursor) search.set("cursor", cursor);
      const response = await http.request(
        `${leadPath(leadId, "/cycles")}?${search.toString()}`,
        { kind: "tenant-scoped", method: "GET", signal },
      );
      return parse(cyclesResponseSchema, response.data);
    },

    async members(cursor?: string, signal?: AbortSignal) {
      const search = new URLSearchParams({ status: "active", limit: "100" });
      if (cursor) search.set("cursor", cursor);
      const response = await http.request(
        `/api/v1/members?${search.toString()}`,
        {
          kind: "tenant-scoped",
          method: "GET",
          signal,
        },
      );
      return parse(membersResponseSchema, response.data);
    },

    async update(
      current: LeadDetailSnapshot,
      body: UpdateLeadInput,
    ): Promise<MutationReceipt> {
      const ifMatch = assertCurrentLeadSnapshot(
        current.snapshot,
        current.lead.id,
        current.lead.revision,
      );
      const response = await http.request(leadPath(current.lead.id), {
        kind: "conditional-mutation",
        method: "PATCH",
        ifMatch,
        body,
      });
      parse(leadViewSchema, response.data);
      return { etag: requireEtag(response), replayed: false };
    },

    async assign(
      current: LeadDetailSnapshot,
      responsibleMembershipId: string | null,
    ): Promise<MutationReceipt> {
      if (responsibleMembershipId) z.uuid().parse(responsibleMembershipId);
      const ifMatch = assertCurrentLeadSnapshot(
        current.snapshot,
        current.lead.id,
        current.lead.revision,
      );
      const response = await http.request(
        leadPath(current.lead.id, "/assignment"),
        {
          kind: "conditional-mutation",
          method: "PATCH",
          ifMatch,
          body: { responsibleMembershipId },
        },
      );
      parse(leadViewSchema, response.data);
      return { etag: requireEtag(response), replayed: false };
    },

    async act(
      current: LeadDetailSnapshot,
      intent: LeadIdempotentAction,
      idempotencyKey: IdempotencyKey,
    ): Promise<MutationReceipt> {
      const ifMatch = assertCurrentLeadSnapshot(
        current.snapshot,
        current.lead.id,
        current.lead.revision,
      );
      const response = await http.request(
        leadPath(current.lead.id, actionSuffix[intent.action]),
        {
          kind: "conditional-idempotent-mutation",
          method: "POST",
          ifMatch,
          idempotencyKey,
          body: intent.body,
        },
      );
      if (response.status === 201) parse(mutationCreatedSchema, response.data);
      return {
        etag: requireEtag(response),
        replayed: response.idempotencyReplayed === true,
      };
    },
  };
}
