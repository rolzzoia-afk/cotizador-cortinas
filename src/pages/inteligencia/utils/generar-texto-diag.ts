// Genera un texto plano de diagnóstico operacional para pegar en una
// conversación nueva con Claude. Función pura — no depende de React ni DOM.

import { ESTADOS_ACTIVOS, ESTADOS_PRODUCCION } from '../Inteligencia.config';
import type { Insumo, Mov, OT, Rack } from '../Inteligencia.types';
import { diasDesde, diasHasta, dgStr } from './formato';

export function generarTextoDiag(
  ots: OT[],
  insumos: Insumo[],
  movs: Mov[],
  racks: Rack[],
): string {
  const lineas: string[] = [];
  const ahora = new Date().toLocaleString('es-CL');

  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('   DIAGNÓSTICO OPERACIONAL — CORTINAS ROLZZO');
  lineas.push(`   Generado: ${ahora}`);
  lineas.push('   Sistema: App de gestión de cortinas roller (Supabase)');
  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('');
  lineas.push('Contexto: Soy dueño/operario de una empresa de cortinas roller.');
  lineas.push('Tengo una app web propia conectada a Supabase que gestiona:');
  lineas.push('órdenes de trabajo (OTs), inventario de insumos, stock de telas,');
  lineas.push('bodeguero/despacho con QR, optimizador de corte de tubos y este panel.');
  lineas.push('');

  // 1. OTs
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('1. ESTADO DE LAS ÓRDENES DE TRABAJO (OTs)');
  lineas.push('───────────────────────────────────────────────────────');
  const porEstado: Record<string, number> = {};
  for (const ot of ots) {
    const e = ot.estado || 'sin estado';
    porEstado[e] = (porEstado[e] || 0) + 1;
  }
  lineas.push(`Total OTs en el sistema: ${ots.length}`);
  for (const [est, cant] of Object.entries(porEstado)) {
    lineas.push(`  · ${est}: ${cant}`);
  }
  lineas.push('');

  const otsActivas = ots.filter((o) => ESTADOS_ACTIVOS.includes(o.estado || ''));
  lineas.push(`OTs activas (${otsActivas.length}):`);
  for (const ot of otsActivas.slice(0, 20)) {
    const otId = dgStr(ot, ['ot']) || '#' + String(ot.id).slice(-6);
    const cli = dgStr(ot, ['nombre_cliente', 'cliente']) || '(sin nombre)';
    const items = (ot.items || []).length;
    const dias = diasDesde(ot.fecha_modificacion);
    const fe = dgStr(ot, ['fecha_entrega', 'fechaEntrega']);
    const dEntr = fe ? diasHasta(fe) : null;
    let flags = '';
    if (ESTADOS_PRODUCCION.includes(ot.estado || '') && dias >= 3)
      flags += ` ⚠ ${dias}d sin movimiento`;
    if (dEntr !== null && dEntr <= 0) flags += ' 🔴 ENTREGA VENCIDA';
    else if (dEntr !== null && dEntr <= 5) flags += ` 🔴 entrega en ${dEntr}d`;
    lineas.push(`  OT ${otId} | ${cli} | ${ot.estado} | ${items} ventana(s)${flags}`);
  }
  if (otsActivas.length > 20) lineas.push(`  ... y ${otsActivas.length - 20} más`);
  lineas.push('');

  // 2. Inventario
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('2. INVENTARIO DE INSUMOS');
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push(`Total insumos en catálogo: ${insumos.length}`);
  lineas.push(`Posiciones de rack cargadas: ${racks.length}`);

  const sinStock = insumos.filter((i) => i.stock_total <= 0);
  const bajoMinimo = insumos.filter(
    (i) => i.minimo != null && i.stock_total > 0 && i.stock_total <= Number(i.minimo),
  );
  lineas.push(`Sin stock: ${sinStock.length}`);
  lineas.push(`Bajo stock mínimo: ${bajoMinimo.length}`);
  lineas.push('');

  if (sinStock.length > 0) {
    lineas.push('Insumos SIN STOCK:');
    for (const i of sinStock.slice(0, 15)) {
      lineas.push(`  · [${i.cod}] ${i.nemotecnico || i.cod} — ${i.categoria || '—'}`);
    }
    if (sinStock.length > 15) lineas.push(`  ... y ${sinStock.length - 15} más`);
    lineas.push('');
  }
  if (bajoMinimo.length > 0) {
    lineas.push('Insumos BAJO MÍNIMO:');
    for (const i of bajoMinimo.slice(0, 15)) {
      const pct = Math.round((i.stock_total / Number(i.minimo)) * 100);
      lineas.push(
        `  · [${i.cod}] ${i.nemotecnico || i.cod} — stock: ${i.stock_total} / mín: ${i.minimo} (${pct}%)`,
      );
    }
    if (bajoMinimo.length > 15) lineas.push(`  ... y ${bajoMinimo.length - 15} más`);
    lineas.push('');
  }

  // 3. Movimientos
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('3. MOVIMIENTOS DE INVENTARIO (últimos 30 días)');
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push(`Total movimientos: ${movs.length}`);
  const tiposCont: Record<string, number> = {};
  for (const m of movs) {
    const t = (m.tipo || 'sin tipo').toLowerCase();
    tiposCont[t] = (tiposCont[t] || 0) + 1;
  }
  for (const [t, n] of Object.entries(tiposCont)) {
    lineas.push(`  · ${t}: ${n} movimientos`);
  }
  lineas.push('');

  const salidas = movs.filter((m) =>
    ['salida', 'despacho'].includes((m.tipo || '').toLowerCase()),
  );
  const consumoMap: Record<string, number> = {};
  for (const m of salidas) {
    const k = (m.codigo || m.producto || '?').trim();
    consumoMap[k] = (consumoMap[k] || 0) + (Number(m.cantidad) || 0);
  }
  const topCons = Object.entries(consumoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (topCons.length > 0) {
    lineas.push('Top 10 insumos más consumidos:');
    for (const [cod, cant] of topCons) {
      const ins = insumos.find((x) => (x.cod || '').toUpperCase() === cod.toUpperCase());
      const desc = ins?.nemotecnico || ins?.cod || cod;
      const stk = ins ? ` | stock actual: ${ins.stock_total}` : '';
      lineas.push(`  · ${desc}: ${cant} unid.${stk}`);
    }
    lineas.push('');
  }

  // 4. Métricas
  lineas.push('───────────────────────────────────────────────────────');
  lineas.push('4. MÉTRICAS RÁPIDAS');
  lineas.push('───────────────────────────────────────────────────────');
  const valorPipeline = otsActivas.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  lineas.push(`Valor total OTs activas: $${valorPipeline.toLocaleString('es-CL')}`);
  const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const movsUltima = movs.filter((m) => m.fecha && new Date(m.fecha).getTime() >= hace7);
  lineas.push(`Movimientos últimos 7 días: ${movsUltima.length}`);
  lineas.push('');
  lineas.push('═══════════════════════════════════════════════════════');
  lineas.push('FIN DEL DIAGNÓSTICO — Puedes preguntarme cualquier cosa');
  lineas.push('sobre estos datos, pedir mejoras, detectar bugs o analizar patrones.');
  lineas.push('═══════════════════════════════════════════════════════');

  return lineas.join('\n');
}
