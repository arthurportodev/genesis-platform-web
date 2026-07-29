import { z } from "zod";

import type { LeadListFilters } from "@/features/leads/api/lead-contracts";

const civilDateSchema = z.iso.date();

export const defaultLeadFilters: LeadListFilters = {
  status: "active",
  sort: "createdAt:desc",
  limit: 25,
};

export function normalizedLeadSearch(value: string): string | undefined {
  const normalized = value.normalize("NFC").trim();
  return normalized.length >= 3 && normalized.length <= 100
    ? normalized
    : undefined;
}

export function leadSearchMessage(value: string): string | null {
  const length = value.normalize("NFC").trim().length;
  if (length === 0 || (length >= 3 && length <= 100)) return null;
  if (length < 3) return "Digite ao menos 3 caracteres para buscar.";
  return "A busca aceita no máximo 100 caracteres.";
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
