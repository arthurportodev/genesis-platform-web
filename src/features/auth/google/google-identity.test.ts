import { isIosGooglePopupUnsupported } from "./google-identity";

describe("Google popup platform policy", () => {
  afterEach(() => {
    document.getElementById("genesis-google-identity-services")?.remove();
    delete window.google;
    vi.resetModules();
  });

  it("keeps the MVP redirect-free on iOS while allowing desktop popup", () => {
    expect(
      isIosGooglePopupUnsupported({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      } as Navigator),
    ).toBe(true);
    expect(
      isIosGooglePopupUnsupported({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        platform: "Win32",
        maxTouchPoints: 0,
      } as Navigator),
    ).toBe(false);
  });

  it("loads GIS conditionally and creates a fresh script after a failed load", async () => {
    const firstModule = await import("./google-identity");
    const firstAttempt = firstModule.loadGoogleIdentityServices();
    const firstScript = document.getElementById(
      "genesis-google-identity-services",
    ) as HTMLScriptElement;
    expect(firstScript.src).toBe("https://accounts.google.com/gsi/client");
    firstScript.dispatchEvent(new Event("error"));
    await expect(firstAttempt).rejects.toThrow("GIS unavailable");
    expect(firstScript).not.toBeInTheDocument();

    const secondAttempt = firstModule.loadGoogleIdentityServices();
    const secondScript = document.getElementById(
      "genesis-google-identity-services",
    ) as HTMLScriptElement;
    expect(secondScript).not.toBe(firstScript);
    window.google = googleApi();
    secondScript.dispatchEvent(new Event("load"));
    await expect(secondAttempt).resolves.toBeUndefined();
  });
});

function googleApi(): NonNullable<Window["google"]> {
  return {
    accounts: {
      id: {
        initialize: vi.fn(),
        renderButton: vi.fn(),
      },
    },
  };
}
