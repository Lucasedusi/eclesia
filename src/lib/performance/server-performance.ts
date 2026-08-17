import "server-only";

type PerformanceMeta = {
  supabaseCalls?: number;
  route?: string;
};

const isEnabled = process.env.PERFORMANCE_TELEMETRY_ENABLED !== "false";
const seenOperations = new Set<string>();

export async function measureServerOperation<T>(
  label: string,
  operation: () => PromiseLike<T>,
  meta: PerformanceMeta = {},
): Promise<T> {
  if (!isEnabled) return operation();

  // performance.now() é apropriado para medir duração e também funciona
  // dentro de "use cache". Não use APIs de dados de requisição, UUIDs ou
  // Date.now() aqui: Cache Components pode executar esta função ao preencher
  // caches, antes de existir uma navegação real.
  const startedAt = performance.now();
  const cacheState = seenOperations.has(label) ? "warm" : "cold";
  let status: "success" | "error" = "success";
  try {
    return await operation();
  } catch (error) {
    status = "error";
    throw error;
  } finally {
    const duration = performance.now() - startedAt;
    seenOperations.add(label);
    console.info("[server-performance]", {
      operation: label,
      durationMs: Number(duration.toFixed(1)),
      supabaseCalls: meta.supabaseCalls ?? 0,
      route: meta.route,
      status,
      cacheState,
    });
  }
}
