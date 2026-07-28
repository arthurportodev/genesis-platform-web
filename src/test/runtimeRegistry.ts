import type { AppRuntime } from "@/app/providers/runtime";

const runtimes = new Set<AppRuntime>();

export function registerTestRuntime(runtime: AppRuntime): void {
  runtimes.add(runtime);
}

export function disposeTestRuntimes(): void {
  for (const runtime of runtimes) runtime.dispose();
  runtimes.clear();
}
