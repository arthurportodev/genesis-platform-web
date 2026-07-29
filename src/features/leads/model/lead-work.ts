import type {
  LeadReturnReviewItem,
  LeadReturnReviewQueueResponse,
  LeadWorkItem,
  LeadWorkListResponse,
} from "@/features/leads/api/lead-contracts";

interface Versioned<T> {
  item: T;
  revision: string;
  asOf: string;
}

function isNewer<T>(candidate: Versioned<T>, current: Versioned<T>): boolean {
  const candidateRevision = BigInt(candidate.revision);
  const currentRevision = BigInt(current.revision);
  if (candidateRevision !== currentRevision)
    return candidateRevision > currentRevision;
  return Date.parse(candidate.asOf) > Date.parse(current.asOf);
}

function composePages<T>(
  pages: readonly {
    items: readonly T[];
    page: LeadWorkListResponse["page"];
  }[],
  identity: (item: T) => string,
  revision: (item: T) => string,
) {
  const order: string[] = [];
  const winners = new Map<string, Versioned<T>>();
  for (const page of pages) {
    for (const item of page.items) {
      const key = identity(item);
      if (!winners.has(key)) order.push(key);
      const candidate = {
        item,
        revision: revision(item),
        asOf: page.page.asOf,
      };
      const current = winners.get(key);
      if (!current || isNewer(candidate, current)) winners.set(key, candidate);
    }
  }
  const finalPage = pages.at(-1)?.page;
  return {
    items: order.flatMap((key) => {
      const winner = winners.get(key);
      return winner ? [winner.item] : [];
    }),
    loaded: winners.size,
    total: finalPage?.total ?? 0,
    asOf: finalPage?.asOf ?? null,
    nextCursor: finalPage?.nextCursor ?? null,
  };
}

export function composeLeadWorkPages(pages: readonly LeadWorkListResponse[]) {
  return composePages<LeadWorkItem>(
    pages,
    (item) => item.id,
    (item) => item.revision,
  );
}

export function composeLeadReturnReviewPages(
  pages: readonly LeadReturnReviewQueueResponse[],
) {
  return composePages<LeadReturnReviewItem>(
    pages,
    (item) => `${item.lead.id}:${item.review.id}`,
    (item) => item.lead.revision,
  );
}
