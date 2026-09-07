export const GENESIS_IF_MATCH_HEADER = "X-Genesis-If-Match";
export const GENESIS_IF_MATCH_HEADER_LOWER = "x-genesis-if-match";
export const GENESIS_LEAD_CONTRACT_HEADER = "X-Genesis-Lead-Contract";
export const GENESIS_LEAD_CONTRACT_HEADER_LOWER = "x-genesis-lead-contract";

const MAX_GENESIS_IF_MATCH_LENGTH = 72;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;
const CANONICAL_UUID =
  "[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}";
const LEAD_ETAG = new RegExp(
  `^"lead:(${CANONICAL_UUID}):(0|[1-9][0-9]*)"$`,
  "u",
);
const PIPELINE_ETAG = new RegExp(
  `^"pipeline:(${CANONICAL_UUID}):(0|[1-9][0-9]*)"$`,
  "u",
);
const CONDITIONAL_LEAD_PATH = new RegExp(
  `^/api/v1/leads/(${CANONICAL_UUID})(?:/(assignment|activities|notes|next-action(?:/(?:reschedule|complete|cancel))?|cycles|move|win|lose|archive|reactivate|return-review/dismiss|expected-value|information))?$`,
  "u",
);
const CONDITIONAL_PIPELINE_PATH = new RegExp(
  `^/api/v1/pipelines/(${CANONICAL_UUID})(?:/stages(?:/order|/(${CANONICAL_UUID})(?:/archive)?))?$`,
  "u",
);
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

export type IfMatchTransportRejection =
  | "connection_header_invalid"
  | "if_match_direct_header_forbidden"
  | "if_match_transport_ambiguous"
  | "if_match_transport_invalid"
  | "if_match_transport_unexpected";

export type TransportHeaderValue =
  string | readonly string[] | null | undefined;

export interface IfMatchTransportInput {
  method: string;
  pathname: string;
  directIfMatch: TransportHeaderValue;
  genesisIfMatch: TransportHeaderValue;
  connection: TransportHeaderValue;
}

export interface IfMatchTransportResult {
  ifMatch?: string;
  rejection?: IfMatchTransportRejection;
  connectionTokens: ReadonlySet<string>;
}

function hasUnsafeAscii(value: string, includeSpace: boolean): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 127 || code < (includeSpace ? 33 : 32)) return true;
  }
  return false;
}

function headerPresent(value: TransportHeaderValue): boolean {
  return value !== null && value !== undefined;
}

export function parseConnectionHeaderTokens(
  value: TransportHeaderValue,
): ReadonlySet<string> | null {
  const tokens = new Set<string>();
  if (!headerPresent(value) || value === "") return tokens;
  if (typeof value !== "string") return null;
  if (value.length > 1_024 || hasUnsafeAscii(value, false)) return null;
  for (const rawToken of value.split(",")) {
    const token = rawToken.trim().toLowerCase();
    if (!HTTP_TOKEN.test(token)) return null;
    tokens.add(token);
  }
  return tokens;
}

function expectedConditionalResource(
  method: string,
  pathname: string,
): { id: string; kind: "lead" | "pipeline" } | null {
  const leadMatch = CONDITIONAL_LEAD_PATH.exec(pathname);
  if (leadMatch) {
    const suffix = leadMatch[2];
    const allowed =
      method === "PATCH"
        ? suffix === undefined || suffix === "assignment"
        : method === "POST" && suffix !== undefined && suffix !== "assignment";
    if (allowed) return { id: leadMatch[1].toLowerCase(), kind: "lead" };
  }
  const pipelineMatch = CONDITIONAL_PIPELINE_PATH.exec(pathname);
  if (!pipelineMatch) return null;
  const pipelineRoot = `/api/v1/pipelines/${pipelineMatch[1]}`;
  const allowed =
    (method === "PATCH" &&
      (pathname === pipelineRoot || pipelineMatch[2] !== undefined)) ||
    (method === "PUT" && pathname.endsWith("/stages/order")) ||
    (method === "PUT" &&
      pipelineMatch[2] !== undefined &&
      !pathname.endsWith("/archive")) ||
    (method === "POST" && pathname.endsWith("/archive"));
  return allowed
    ? { id: pipelineMatch[1].toLowerCase(), kind: "pipeline" }
    : null;
}

export function validateGenesisIfMatch(
  value: string,
  expectedId: string,
  expectedKind: "lead" | "pipeline" = "lead",
): boolean {
  if (value.length === 0 || value.length > MAX_GENESIS_IF_MATCH_LENGTH) {
    return false;
  }
  const match = (expectedKind === "lead" ? LEAD_ETAG : PIPELINE_ETAG).exec(
    value,
  );
  if (!match || match[1].toLowerCase() !== expectedId.toLowerCase()) {
    return false;
  }
  try {
    return BigInt(match[2]) <= MAX_POSTGRES_BIGINT;
  } catch {
    return false;
  }
}

export function resolveGenesisIfMatchTransport(
  input: IfMatchTransportInput,
): IfMatchTransportResult {
  const connectionTokens = parseConnectionHeaderTokens(input.connection);
  if (!connectionTokens) {
    return {
      rejection: "connection_header_invalid",
      connectionTokens: new Set(),
    };
  }

  const hasDirect = headerPresent(input.directIfMatch);
  const hasPrivate = headerPresent(input.genesisIfMatch);
  if (hasDirect && hasPrivate) {
    return { rejection: "if_match_transport_ambiguous", connectionTokens };
  }
  if (hasDirect) {
    return {
      rejection: "if_match_direct_header_forbidden",
      connectionTokens,
    };
  }
  if (
    connectionTokens.has("if-match") ||
    connectionTokens.has(GENESIS_IF_MATCH_HEADER_LOWER)
  ) {
    return { rejection: "if_match_transport_ambiguous", connectionTokens };
  }
  if (!hasPrivate) return { connectionTokens };

  const expectedResource = expectedConditionalResource(
    input.method,
    input.pathname,
  );
  if (!expectedResource) {
    return { rejection: "if_match_transport_unexpected", connectionTokens };
  }
  if (typeof input.genesisIfMatch !== "string") {
    return { rejection: "if_match_transport_invalid", connectionTokens };
  }
  return validateGenesisIfMatch(
    input.genesisIfMatch,
    expectedResource.id,
    expectedResource.kind,
  )
    ? { ifMatch: input.genesisIfMatch, connectionTokens }
    : { rejection: "if_match_transport_invalid", connectionTokens };
}
