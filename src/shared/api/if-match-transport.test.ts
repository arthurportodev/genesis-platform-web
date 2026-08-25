import {
  resolveGenesisIfMatchTransport,
  validateGenesisIfMatch,
} from "@/shared/api/if-match-transport";

const leadId = "00000000-0000-4000-8000-000000000001";
const token = `"lead:${leadId}:7"`;

function resolve(
  overrides: Partial<Parameters<typeof resolveGenesisIfMatchTransport>[0]> = {},
) {
  return resolveGenesisIfMatchTransport({
    method: "PATCH",
    pathname: `/api/v1/leads/${leadId}`,
    directIfMatch: null,
    genesisIfMatch: token,
    connection: null,
    ...overrides,
  });
}

describe("Genesis If-Match transport policy", () => {
  it.each([
    ["PATCH", `/api/v1/leads/${leadId}`],
    ["PATCH", `/api/v1/leads/${leadId}/assignment`],
    ["POST", `/api/v1/leads/${leadId}/activities`],
    ["POST", `/api/v1/leads/${leadId}/notes`],
    ["POST", `/api/v1/leads/${leadId}/next-action`],
    ["POST", `/api/v1/leads/${leadId}/next-action/reschedule`],
    ["POST", `/api/v1/leads/${leadId}/next-action/complete`],
    ["POST", `/api/v1/leads/${leadId}/next-action/cancel`],
    ["POST", `/api/v1/leads/${leadId}/move`],
    ["POST", `/api/v1/leads/${leadId}/win`],
    ["POST", `/api/v1/leads/${leadId}/lose`],
    ["POST", `/api/v1/leads/${leadId}/archive`],
    ["POST", `/api/v1/leads/${leadId}/reactivate`],
    ["POST", `/api/v1/leads/${leadId}/return-review/dismiss`],
  ])("accepts the contracted %s %s route", (method, pathname) => {
    expect(resolve({ method, pathname })).toMatchObject({ ifMatch: token });
  });

  it.each([
    ["GET", `/api/v1/leads/${leadId}`],
    ["DELETE", `/api/v1/leads/${leadId}`],
    ["POST", `/api/v1/leads/${leadId}`],
    ["PATCH", `/api/v1/leads/${leadId}/move`],
    ["POST", "/api/v1/auth/logout"],
  ])("rejects private transport on unexpected %s %s", (method, pathname) => {
    expect(resolve({ method, pathname }).rejection).toBe(
      "if_match_transport_unexpected",
    );
  });

  it("preserves a request that has no conditional header", () => {
    const result = resolve({
      method: "GET",
      pathname: "/api/v1/auth/bootstrap",
      genesisIfMatch: null,
    });
    expect(result.ifMatch).toBeUndefined();
    expect(result.rejection).toBeUndefined();
  });

  it.each([
    [token, null, "if_match_direct_header_forbidden"],
    [token, token, "if_match_transport_ambiguous"],
  ])(
    "rejects standard or ambiguous external transport",
    (direct, privateValue, reason) => {
      expect(
        resolve({ directIfMatch: direct, genesisIfMatch: privateValue })
          .rejection,
      ).toBe(reason);
    },
  );

  it("rejects duplicate values and Connection-nominated smuggling", () => {
    expect(resolve({ genesisIfMatch: [token, token] }).rejection).toBe(
      "if_match_transport_invalid",
    );
    expect(resolve({ connection: "X-Genesis-If-Match" }).rejection).toBe(
      "if_match_transport_ambiguous",
    );
    expect(resolve({ connection: "valid, invalid token" }).rejection).toBe(
      "connection_header_invalid",
    );
  });

  it.each([
    'W/"lead:00000000-0000-4000-8000-000000000001:1"',
    "*",
    '"lead:00000000-0000-4000-8000-000000000001:1", "other"',
    ' "lead:00000000-0000-4000-8000-000000000001:1"',
    '"lead:00000000-0000-4000-8000-000000000001:01"',
    '"lead:00000000-0000-4000-8000-000000000001:-1"',
    '"lead:00000000-0000-4000-8000-000000000001:9223372036854775808"',
    '"lead:00000000-0000-4000-8000-000000000002:1"',
    '"LEAD:00000000-0000-4000-8000-000000000001:1"',
    '"lead:not-a-uuid:1"',
    '"lead:00000000-0000-4000-8000-000000000001:1"\r\nInjected: yes',
    `"lead:${leadId}:${"9".repeat(64)}"`,
    "",
  ])("rejects non-canonical token %s", (value) => {
    expect(validateGenesisIfMatch(value, leadId)).toBe(false);
    expect(resolve({ genesisIfMatch: value }).rejection).toBe(
      "if_match_transport_invalid",
    );
  });

  it("accepts the PostgreSQL bigint maximum", () => {
    expect(
      validateGenesisIfMatch(`"lead:${leadId}:9223372036854775807"`, leadId),
    ).toBe(true);
  });
});
