import { z } from "zod";

import type {
  LeadKanbanFilters,
  LeadListFilters,
  LeadStage,
} from "@/features/leads/api/lead-contracts";

const civilDateSchema = z.iso.date();

export const defaultLeadFilters: LeadListFilters = {
  status: "active",
  sort: "createdAt:desc",
  limit: 25,
};

export const defaultLeadKanbanFilters: LeadKanbanFilters = { limit: 20 };

export function normalizedLeadSearch(value: string): string | undefined {
  const normalized = value.normalize("NFC").trim();
  const length = [...normalized].length;
  return length >= 3 && length <= 100 ? normalized : undefined;
}

export function leadSearchMessage(value: string): string | null {
  const length = [...value.normalize("NFC").trim()].length;
  if (length === 0 || (length >= 3 && length <= 100)) return null;
  if (length < 3) return "Digite ao menos 3 caracteres para buscar.";
  return "A busca aceita no máximo 100 caracteres.";
}

export function canonicalLeadKanbanFilters(
  filters: LeadKanbanFilters,
): LeadKanbanFilters {
  const assignmentFilters = [
    filters.responsibleMembershipId,
    filters.assignedToMe,
    filters.unassigned,
  ].filter((value) => value !== undefined && value !== false);
  if (assignmentFilters.length > 1)
    throw new Error("Os filtros de responsável são mutuamente exclusivos.");
  const q = filters.q?.normalize("NFC").trim();
  if (q && ([...q].length < 3 || [...q].length > 100))
    throw new Error("A busca do Kanban deve conter entre 3 e 100 caracteres.");
  if (
    !Number.isInteger(filters.limit) ||
    filters.limit < 1 ||
    filters.limit > 20
  )
    throw new Error("O limite do Kanban deve estar entre 1 e 20.");
  const canonical: LeadKanbanFilters = {
    limit: filters.limit,
    ...(q ? { q } : {}),
    ...(filters.responsibleMembershipId
      ? { responsibleMembershipId: filters.responsibleMembershipId }
      : {}),
    ...(filters.assignedToMe ? { assignedToMe: true } : {}),
    ...(filters.unassigned ? { unassigned: true } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.nextActionState
      ? { nextActionState: filters.nextActionState }
      : {}),
    ...(filters.createdFrom ? { createdFrom: filters.createdFrom } : {}),
    ...(filters.createdTo ? { createdTo: filters.createdTo } : {}),
    ...(filters.lastEntryFrom ? { lastEntryFrom: filters.lastEntryFrom } : {}),
    ...(filters.lastEntryTo ? { lastEntryTo: filters.lastEntryTo } : {}),
  };
  return canonical;
}

export function buildLeadKanbanPath(
  filters: LeadKanbanFilters,
  page: { stage?: LeadStage; cursor?: string } = {},
): string {
  const canonical = canonicalLeadKanbanFilters(filters);
  if (
    (canonical.createdFrom === undefined) !==
    (canonical.createdTo === undefined)
  )
    throw new Error("O período de criação exige os dois limites.");
  if (
    (canonical.lastEntryFrom === undefined) !==
    (canonical.lastEntryTo === undefined)
  )
    throw new Error("O período da última entrada exige os dois limites.");
  if (page.cursor && !page.stage)
    throw new Error("O cursor do Kanban exige uma etapa.");
  const search = new URLSearchParams({ limit: String(canonical.limit) });
  if (canonical.q) search.set("q", canonical.q);
  if (canonical.responsibleMembershipId)
    search.set("responsibleMembershipId", canonical.responsibleMembershipId);
  if (canonical.assignedToMe) search.set("assignedToMe", "true");
  if (canonical.unassigned) search.set("unassigned", "true");
  if (canonical.source) search.set("source", canonical.source);
  if (canonical.nextActionState)
    search.set("nextActionState", canonical.nextActionState);
  if (canonical.createdFrom) search.set("createdFrom", canonical.createdFrom);
  if (canonical.createdTo)
    search.set("createdTo", nextCivilDate(canonical.createdTo));
  if (canonical.lastEntryFrom)
    search.set("lastEntryFrom", canonical.lastEntryFrom);
  if (canonical.lastEntryTo)
    search.set("lastEntryTo", nextCivilDate(canonical.lastEntryTo));
  if (page.stage) search.set("stage", page.stage);
  if (page.cursor) search.set("cursor", page.cursor);
  return `/api/v1/leads/kanban?${search.toString()}`;
}

export function nextCivilDate(value: string): string {
  const parsed = civilDateSchema.parse(value);
  const [year, month, day] = parsed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

export function buildLeadListPath(
  filters: LeadListFilters,
  cursor?: string,
): string {
  const search = new URLSearchParams();
  search.set("status", filters.status);
  search.set("sort", filters.sort);
  search.set("limit", String(filters.limit));
  if (filters.q) search.set("q", filters.q);
  if (filters.stage) search.set("stage", filters.stage);
  if (filters.source) search.set("source", filters.source);
  if (filters.responsibleMembershipId)
    search.set("responsibleMembershipId", filters.responsibleMembershipId);
  if (filters.assignedToMe) search.set("assignedToMe", "true");
  if (filters.unassigned) search.set("unassigned", "true");
  if (filters.nextActionState)
    search.set("nextActionState", filters.nextActionState);
  if (filters.returnPending !== undefined)
    search.set("returnPending", String(filters.returnPending));
  if (filters.createdFrom) search.set("createdFrom", filters.createdFrom);
  if (filters.createdTo)
    search.set("createdTo", nextCivilDate(filters.createdTo));
  if (filters.lastEntryFrom) search.set("lastEntryFrom", filters.lastEntryFrom);
  if (filters.lastEntryTo)
    search.set("lastEntryTo", nextCivilDate(filters.lastEntryTo));
  if (cursor) search.set("cursor", cursor);
  return `/api/v1/leads?${search.toString()}`;
}
