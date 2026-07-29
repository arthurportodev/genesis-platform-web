import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { PendingChangesProvider } from "@/shared/navigation/PendingChangesProvider";
import {
  usePendingChanges,
  usePendingChangesRegistration,
} from "@/shared/navigation/pending-changes";

function Harness() {
  const [pending, setPending] = useState(true);
  const [result, setResult] = useState<boolean | null>(null);
  const changes = usePendingChanges();
  usePendingChangesRegistration(pending, "Resultado incerto; descartar?");
  return (
    <>
      <button type="button" onClick={() => setPending(false)}>
        Limpar
      </button>
      <button
        type="button"
        onClick={() => setResult(changes.confirmDiscard("Descartar?"))}
      >
        Trocar
      </button>
      <output>{result === null ? "" : String(result)}</output>
    </>
  );
}

it("confirma somente quando existe alteração pendente", async () => {
  const confirm = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  render(
    <PendingChangesProvider>
      <Harness />
    </PendingChangesProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Trocar" }));
  expect(confirm).toHaveBeenCalledWith("Resultado incerto; descartar?");
  expect(screen.getByText("false")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Limpar" }));
  await user.click(screen.getByRole("button", { name: "Trocar" }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByText("true")).toBeVisible();
  confirm.mockRestore();
});
