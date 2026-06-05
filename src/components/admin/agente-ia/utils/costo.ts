// Cálculo y formateo de costos del Playground del Agente IA.

import { PRECIO_INPUT_USD_POR_M, PRECIO_OUTPUT_USD_POR_M } from '../Playground.config';

export function calcularCostoUSD(
  usage: { input_tokens: number; output_tokens: number } | null,
): number {
  if (!usage) return 0;
  return (
    (usage.input_tokens * PRECIO_INPUT_USD_POR_M) / 1_000_000 +
    (usage.output_tokens * PRECIO_OUTPUT_USD_POR_M) / 1_000_000
  );
}

export function formatUSD(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.001) return '<$0.001';
  return '$' + usd.toFixed(4);
}
