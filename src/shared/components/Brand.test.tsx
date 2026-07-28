import { screen } from "@testing-library/react";

import { renderAppAt } from "@/test/renderApp";

describe("Brand", () => {
  it("usa a configuração compartilhada para a marca textual", async () => {
    await renderAppAt("/login");

    expect(
      screen.getByRole("link", { name: "Genesis Platform, início" }),
    ).toHaveTextContent("Genesis Platform");
  });
});
