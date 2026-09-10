const GIS_SCRIPT_ID = "genesis-google-identity-services";
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";

let loader: Promise<void> | null = null;

export function isIosGooglePopupUnsupported(
  navigatorValue: Navigator = navigator,
): boolean {
  return (
    /iPad|iPhone|iPod/u.test(navigatorValue.userAgent) ||
    (navigatorValue.platform === "MacIntel" &&
      navigatorValue.maxTouchPoints > 1)
  );
}

export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      GIS_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const fail = () => {
      loader = null;
      script.remove();
      reject(new Error("GIS unavailable"));
    };
    const onLoad = () => (window.google?.accounts.id ? resolve() : fail());
    const onError = () => fail();
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.id = GIS_SCRIPT_ID;
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      document.head.append(script);
    }
  });
  return loader;
}
