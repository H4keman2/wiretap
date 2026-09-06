import { createServerFn } from "@tanstack/react-start";

import type { SosDiagnostics } from "./sos-diagnostics";
import type { SosHealth } from "./sos";

/**
 * Internal-only. This walks the raw ESPN endpoints Wire Tap depends on and
 * returns their live URLs, HTTP statuses, timings, and a sample of
 * unresolved players — implementation detail that has no reason to be
 * reachable by an anonymous visitor. It used to be callable (and rendered,
 * via SosDebugPanel) by anyone who loaded /settings; it's now refused
 * outside local development regardless of who calls it or from where.
 */
export const getSosDiagnostics = createServerFn({ method: "GET" }).handler(
  async (): Promise<SosDiagnostics> => {
    if (!import.meta.env.DEV) {
      throw new Error("Diagnostics are only available in development.");
    }
    const { collectSosDiagnostics } = await import("./sos-diagnostics.server");
    return collectSosDiagnostics();
  },
);

/**
 * Reads coverage health, touching the pool first so a degraded cache triggers
 * its automatic re-probe before we report the numbers.
 */
export const getSosHealthStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SosHealth> => {
    const { getPlayerPool } = await import("./players.server");
    const { getSosHealth } = await import("./sos.server");
    await getPlayerPool();
    return getSosHealth();
  },
);
