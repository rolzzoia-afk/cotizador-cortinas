// Helper de contenido QR para una tela en su posición/almacén.
//
// NOTA: los mapas físicos del rack (RACK_MAP / B1/B2) se eliminaron junto con
// el tab de rack congelado (telas_slots). La vista "Colmena" ahora se dibuja
// en vivo desde colmena_panos (ver colmenaViva.ts + ColmenaVivaTab.tsx).

export function telaToQRContent(posicion: string, almacen: string | null | undefined): string {
  const ascii = (s: string | null | undefined) =>
    String(s ?? '')
      .trim()
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, '_');
  return `TEL_LOC:${ascii(posicion)}|${ascii(almacen)}`;
}
