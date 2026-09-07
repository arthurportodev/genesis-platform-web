import { z } from "zod";

export interface PipelineSearch {
  pipelineId?: string;
}

export function validatePipelineSearch(
  search: Record<string, unknown>,
): PipelineSearch {
  return typeof search.pipelineId === "string" &&
    z.uuid().safeParse(search.pipelineId).success
    ? { pipelineId: search.pipelineId }
    : {};
}

export interface LeadCreateSearch {
  from?: "pipeline";
  pipelineId?: string;
}

export function validateLeadCreateSearch(
  search: Record<string, unknown>,
): LeadCreateSearch {
  const pipelineId =
    typeof search.pipelineId === "string" &&
    z.uuid().safeParse(search.pipelineId).success
      ? search.pipelineId
      : undefined;
  if (search.from !== "pipeline") return {};
  return pipelineId ? { from: "pipeline", pipelineId } : { from: "pipeline" };
}
