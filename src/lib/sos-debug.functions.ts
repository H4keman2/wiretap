import { createServerFn } from "@tanstack/react-start";

import type { SosDiagnostics } from "./sos-diagnostics";
import type { SosHealth } from "./sos";

export const getSosDiagnostics = createServerFn({ method: "GET" }).handler(
  async (): Promise<SosDiagnostics> => {
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
