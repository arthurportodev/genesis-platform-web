const DEFAULT_APP_NAME = "Genesis Platform";

export const environment = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME?.trim() || DEFAULT_APP_NAME,
});
