import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "@/test/msw/server";
import { disposeTestRuntimes } from "@/test/runtimeRegistry";

window.scrollTo = () => undefined;

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  disposeTestRuntimes();
  server.resetHandlers();
  window.localStorage.clear();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
