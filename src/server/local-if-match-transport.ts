import type { IncomingMessage, ServerResponse } from "node:http";

import {
  GENESIS_IF_MATCH_HEADER_LOWER,
  resolveGenesisIfMatchTransport,
} from "../shared/api/if-match-transport.js";

function rejectLocalRequest(response: ServerResponse): void {
  response.statusCode = 400;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("CDN-Cache-Control", "no-store");
  response.setHeader("Vercel-CDN-Cache-Control", "no-store");
  response.end(
    JSON.stringify({
      statusCode: 400,
      message: "API integration unavailable.",
    }),
  );
}

export function applyLocalIfMatchTransport(
  request: IncomingMessage,
  response: ServerResponse,
  pathname: string,
): boolean {
  const transport = resolveGenesisIfMatchTransport({
    method: request.method ?? "",
    pathname,
    directIfMatch: request.headers["if-match"],
    genesisIfMatch: request.headers[GENESIS_IF_MATCH_HEADER_LOWER],
    connection: request.headers.connection,
  });
  if (transport.rejection) {
    rejectLocalRequest(response);
    return false;
  }

  for (const name of Object.keys(request.headers)) {
    if (name.toLowerCase().startsWith("x-genesis-")) {
      delete request.headers[name];
    }
  }
  if (transport.ifMatch) request.headers["if-match"] = transport.ifMatch;
  return true;
}
