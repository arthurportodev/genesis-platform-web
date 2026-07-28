import { environment } from "@/shared/config/environment";

describe("environment", () => {
  it("expõe configuração pública tipada, estável e sem segredos", () => {
    expect(environment).toEqual({ appName: "Genesis Platform" });
    expect(Object.isFrozen(environment)).toBe(true);
    expect(Object.keys(environment)).toEqual(["appName"]);
  });
});
