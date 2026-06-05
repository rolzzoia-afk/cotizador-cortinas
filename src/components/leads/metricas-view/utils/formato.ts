// Helpers de formato puros del dashboard de Métricas de Leads.

export const fmtCLP = (n: number): string => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
};

export const fmtPct = (n: number, decimales = 1): string =>
  `${n.toFixed(decimales).replace('.', ',')}%`;
