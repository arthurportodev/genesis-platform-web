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
  const opaque = asEntityTag(etag);
  if (!opaque || opaque === "*")
    throw new Error("Resposta de Lead sem ETag específico.");
  return { etag: opaque, leadId, revision };
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
