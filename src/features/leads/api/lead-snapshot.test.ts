import {
  assertCurrentLeadSnapshot,
  createLeadSnapshot,
} from "@/features/leads/api/lead-snapshot";

const leadId = "00000000-0000-4000-8000-000000000010";
const otherLeadId = "00000000-0000-4000-8000-000000000011";
const strongEtag = `"lead:${leadId}:3"`;

it("preserva o ETag forte canônico do mesmo Lead e revisão", () => {
  const snapshot = createLeadSnapshot(strongEtag, leadId, "3");
  expect(assertCurrentLeadSnapshot(snapshot, leadId, "3")).toBe(strongEtag);
});

it("canonicaliza o ETag weak equivalente antes de armazenar o snapshot", () => {
  const snapshot = createLeadSnapshot(`W/${strongEtag}`, leadId, "3");
  expect(assertCurrentLeadSnapshot(snapshot, leadId, "3")).toBe(strongEtag);
});

it.each(["strong", "weak"] as const)(
  "rejeita ETag %s pertencente a outro Lead",
  (strength) => {
    const etag = `"lead:${otherLeadId}:3"`;
    expect(() =>
      createLeadSnapshot(strength === "weak" ? `W/${etag}` : etag, leadId, "3"),
    ).toThrow(/ETag específico/u);
  },
);

it.each(["strong", "weak"] as const)(
  "rejeita ETag %s pertencente a outra revisão",
  (strength) => {
    const etag = `"lead:${leadId}:4"`;
    expect(() =>
      createLeadSnapshot(strength === "weak" ? `W/${etag}` : etag, leadId, "3"),
    ).toThrow(/ETag específico/u);
  },
);

it.each([
  undefined,
  "*",
  "W/*",
  '"opaque"',
  'W/"opaque"',
  `W/ ${strongEtag}`,
  `w/${strongEtag}`,
  `"lead:${leadId}:03"`,
  `"lead:${leadId}:3`,
])("rejeita ETag ausente, curinga ou malformado: %s", (etag) => {
  expect(() => createLeadSnapshot(etag, leadId, "3")).toThrow(
    /ETag específico/u,
  );
});

it("continua vinculando o snapshot à versão exibida", () => {
  const snapshot = createLeadSnapshot(strongEtag, leadId, "3");
  expect(() => assertCurrentLeadSnapshot(snapshot, leadId, "4")).toThrow(
    /versão exibida/u,
  );
});
