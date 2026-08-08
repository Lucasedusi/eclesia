import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";

type PerformanceMeta = {
  supabaseCalls?: number;
  route?: string;
};

const isEnabled = process.env.NODE_ENV === "development";

const getRequestTrace = cache(() => ({
  id: randomUUID().slice(0, 8),
  startedAt: performance.now(),
}));

export async function measureServerOperation<T>(
  label: string,
  operation: () => PromiseLike<T>,
  meta: PerformanceMeta = {},
): Promise<T> {
  if (!isEnabled) return operation();

  const trace = getRequestTrace();
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    const duration = performance.now() - startedAt;
    const elapsed = performance.now() - trace.startedAt;
    console.info(`[performance:${trace.id}] ${label}`, {
      durationMs: Number(duration.toFixed(1)),
      elapsedMs: Number(elapsed.toFixed(1)),
      supabaseCalls: meta.supabaseCalls ?? 0,
      route: meta.route,
    });
  }
}
