export const dashboardPaths = ["/", "/chat", "/fila", "/metricas", "/regras"] as const;

export type DashboardPath = (typeof dashboardPaths)[number];

export function normalizeDashboardPath(path: string): string {
  const pathname = path.split("?")[0].replace(/\/+$/, "");
  return pathname || "/";
}

export function isDashboardPath(path: string): path is DashboardPath {
  return dashboardPaths.includes(path as DashboardPath);
}
