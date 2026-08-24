import { createServerFn } from "@tanstack/react-start";

import type { SosDiagnostics } from "./sos-diagnostics";

export const getSosDiagnostics = createServerFn({ method: "GET" }).handler(
  async (): Promise<SosDiagnostics> => {
    const { collectSosDiagnostics } = await import("./sos-diagnostics.server");
    return collectSosDiagnostics();
  },
);
