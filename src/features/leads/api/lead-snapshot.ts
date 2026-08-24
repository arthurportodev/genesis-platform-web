import { z } from "zod";

import { asEntityTag, type EntityTag } from "@/shared/api/etag";

export interface LeadSnapshot {
  etag: EntityTag;
  leadId: string;
  revision: string;
}

export function createLeadSnapshot(
  etag: string | undefined,
  leadId: string,
  revision: string,
): LeadSnapshot {
  z.uuid().parse(leadId);
  z.string()
    .regex(/^(0|[1-9]\d*)$/u)
    .parse(revision);
  const canonical = `"lead:${leadId}:${revision}"`;
  if (etag !== canonical && etag !== `W/${canonical}`)
    throw new Error("Resposta de Lead sem ETag específico.");
  const trusted = asEntityTag(canonical);
  if (!trusted) throw new Error("Resposta de Lead sem ETag específico.");
  return { etag: trusted, leadId, revision };
}

export function assertCurrentLeadSnapshot(
  snapshot: LeadSnapshot,
  leadId: string,
  revision: string,
): EntityTag {
  if (snapshot.leadId !== leadId || snapshot.revision !== revision)
    throw new Error("O snapshot do Lead não corresponde à versão exibida.");
  return snapshot.etag;
}
