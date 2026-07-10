export type SecuritySignalKind =
  | "auth_denied"
  | "rate_limited"
  | "startup_validation"
  | "webhook_denied"
  | "oauth_denied";

export type SecuritySignal = {
  kind: SecuritySignalKind;
  routeId?: string;
  reason?: string;
  principalType?: string;
  status?: number;
  method?: string;
  pathname?: string;
  timestamp: string;
};

export type SecuritySignalSnapshot = {
  total: number;
  by_kind: Record<SecuritySignalKind, number>;
  by_route: Record<string, number>;
  recent: SecuritySignal[];
};

const MAX_RECENT_SIGNALS = 100;

const signalCounts: Record<SecuritySignalKind, number> = {
  auth_denied: 0,
  rate_limited: 0,
  startup_validation: 0,
  webhook_denied: 0,
  oauth_denied: 0
};

const signalByRoute = new Map<string, number>();
const recentSignals: SecuritySignal[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export function recordSecuritySignal(input: Omit<SecuritySignal, "timestamp">): SecuritySignal {
  const signal: SecuritySignal = {
    ...input,
    timestamp: nowIso()
  };

  signalCounts[input.kind] += 1;

  if (input.routeId) {
    signalByRoute.set(input.routeId, (signalByRoute.get(input.routeId) ?? 0) + 1);
  }

  recentSignals.unshift(signal);
  if (recentSignals.length > MAX_RECENT_SIGNALS) {
    recentSignals.length = MAX_RECENT_SIGNALS;
  }

  return signal;
}

export function getSecuritySignalSnapshot(limit = 20): SecuritySignalSnapshot {
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), MAX_RECENT_SIGNALS) : 20;

  return {
    total: Object.values(signalCounts).reduce((sum, value) => sum + value, 0),
    by_kind: { ...signalCounts },
    by_route: Object.fromEntries(signalByRoute.entries()),
    recent: recentSignals.slice(0, normalizedLimit)
  };
}

export function resetSecuritySignalsForTests(): void {
  for (const key of Object.keys(signalCounts) as SecuritySignalKind[]) {
    signalCounts[key] = 0;
  }

  signalByRoute.clear();
  recentSignals.length = 0;
}
