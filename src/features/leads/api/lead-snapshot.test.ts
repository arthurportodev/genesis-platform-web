import {
  assertCurrentLeadSnapshot,
  createLeadSnapshot,
} from "@/features/leads/api/lead-snapshot";

const leadId = "00000000-0000-4000-8000-000000000010";

it("trata ETag como valor opaco ligado ao Lead e à revisão", () => {
  const snapshot = createLeadSnapshot(`"opaque-value"`, leadId, "3");
  expect(assertCurrentLeadSnapshot(snapshot, leadId, "3")).toBe(
    `"opaque-value"`,
  );
  expect(() => assertCurrentLeadSnapshot(snapshot, leadId, "4")).toThrow(
    /versão exibida/u,
  );
  expect(() => createLeadSnapshot("*", leadId, "3")).toThrow(
    /ETag específico/u,
  );
});
