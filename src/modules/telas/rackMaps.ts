// Mapas físicos del rack de telas — extraídos de MAPA-COLMENA del Excel.
// RACK_MAP  = Bodega LIBERADO (slots A* + B* + VR*)
// B1_*/B2_* = Bodegas MATERIAS PRIMAS (slots generados programáticamente)

export type RackRow = {
  num: number;
  slots: (string | null)[];
};
export type RackConfig = {
  cols: string[];
  rows: RackRow[];
};
export type RackMap = Record<string, RackConfig>;

export const RACK_MAP: RackMap = {
  'RACK 1': {
    cols: ['Q', 'R', 'S', 'T', 'U', 'V'],
    rows: [
      { num: 1, slots: ['A56', 'A55', 'A54', 'A53', 'A52', null] },
      { num: 2, slots: ['A47', null, 'A48', 'A49', 'A50', 'A51'] },
      { num: 3, slots: ['A46', 'A45', 'A44', 'A43', 'A42', 'A41'] },
      { num: 4, slots: ['A35', 'A36', 'A37', 'A38', 'A39', 'A40'] },
      { num: 5, slots: ['A34', 'A33', 'A32', 'A31', 'A30', 'A29'] },
      { num: 6, slots: ['A23', 'A24', 'A25', 'A26', 'A27', 'A28'] },
      { num: 7, slots: ['A22', 'A21', 'A20', 'A19', 'A18', 'A17'] },
      { num: 8, slots: ['A11', 'A12', 'A13', 'A14', 'A15', 'A16'] },
      { num: 9, slots: ['A10', 'A09', 'A08', 'A07', 'A06', null] },
      { num: 10, slots: ['A01', 'A02', 'A03', 'A04', 'A05', null] },
      { num: 11, slots: [null, null, null, null, null, null] },
      { num: 12, slots: [null, null, null, null, null, null] },
    ],
  },
  'RACK 2': {
    cols: ['Q', 'R', 'S', 'T', 'U', 'V'],
    rows: [
      { num: 1, slots: ['B30', 'B29', 'B28', 'B27', 'B26', 'B25'] },
      { num: 2, slots: ['B19', 'B20', 'B21', 'B22', 'B23', 'B24'] },
      { num: 3, slots: ['B18', 'B17', 'B16', 'B15', 'B14', 'B13'] },
      { num: 4, slots: ['B07', 'B08', 'B09', 'B10', 'B11', 'B12'] },
      { num: 5, slots: ['B06', 'B05', 'B04', 'B03', 'B02', 'B01'] },
      { num: 6, slots: ['A79', 'A80', 'A81', 'A82', 'A83', 'A84'] },
      { num: 7, slots: ['A78', 'A77', 'A76', 'A75', 'A74', 'A73'] },
      { num: 8, slots: ['A67', 'A68', 'A69', 'A70', 'A71', 'A72'] },
      { num: 9, slots: ['A66', 'A65', 'A64', 'A63', 'A62', null] },
      { num: 10, slots: ['A57', 'A58', 'A59', 'A60', 'A61', null] },
      { num: 11, slots: [null, null, null, null, null, null] },
      { num: 12, slots: [null, null, null, null, null, null] },
    ],
  },
  'RACK 3': {
    cols: ['Q', 'R', 'S', 'T', 'U', 'V'],
    rows: [
      { num: 1, slots: ['B88', 'B87', 'B86', 'B85', 'B84', 'B83'] },
      { num: 2, slots: ['B82', 'B81', 'B80', 'B79', 'B78', 'B77'] },
      { num: 3, slots: ['B76', 'B75', 'B74', 'B73', 'B72', null] },
      { num: 4, slots: ['B67', 'B68', 'B69', 'B70', 'B71', null] },
      { num: 5, slots: ['B66', 'B65', 'B64', 'B63', 'B62', 'B61'] },
      { num: 6, slots: ['B55', 'B56', 'B57', 'B58', 'B59', 'B60'] },
      { num: 7, slots: ['B54', 'B53', 'B52', 'B51', 'B50', 'B49'] },
      { num: 8, slots: ['B43', 'B44', 'B45', 'B46', 'B47', 'B48'] },
      { num: 9, slots: ['B42', 'B41', 'B40', 'B39', 'B38', 'B37'] },
      { num: 10, slots: ['B31', 'B32', 'B33', 'B34', 'B35', 'B36'] },
      { num: 11, slots: [null, null, null, null, null, null] },
      { num: 12, slots: [null, null, null, null, null, null] },
    ],
  },
  'RACK 4': {
    cols: ['Q', 'R', 'S', 'T', 'U', 'V', 'X'],
    rows: [
      { num: 1, slots: ['VR53', 'VR54', 'VR55', 'VR56', null, 'VR57', null] },
      { num: 2, slots: ['VR52', 'VR51', 'VR50', 'VR49', 'VR48', 'VR47', null] },
      { num: 3, slots: ['VR41', 'VR42', 'VR43', 'VR44', 'VR45', 'VR46', null] },
      { num: 4, slots: ['VR40', 'VR39', 'VR38', 'VR37', 'VR36', 'VR35', 'VR34'] },
      { num: 5, slots: ['VR29', null, 'VR30', 'VR31', 'VR32', 'VR33', null] },
      { num: 6, slots: [null, 'VR28', 'VR27', 'VR26', 'VR25', 'VR24', null] },
      { num: 7, slots: [null, 'VR18', 'VR19', 'VR20', 'VR21', 'VR22', 'VR23'] },
      { num: 8, slots: [null, null, 'VR17', 'VR16', 'VR14', 'VR13', 'VR12'] },
      { num: 9, slots: ['VR07', 'VR08', 'VR09', 'VR10', 'VR11', null, null] },
      { num: 10, slots: ['VR06', 'VR05', 'VR04', 'VR03', 'VR02', 'VR01', null] },
      { num: 11, slots: ['VR58', 'VR59', 'VR60', 'VR61', 'VR62', null, null] },
      { num: 12, slots: [null, null, null, null, null, null, null] },
    ],
  },
};

function generarMP(
  prefix: 'B1' | 'B2',
  rack4Cols: string[],
  numRacks: number,
  maxRows: number,
): RackMap {
  const stdCols = ['Q', 'R', 'S', 'T', 'U', 'V'];
  const maps: RackMap = {};
  for (let r = 1; r <= numRacks; r++) {
    const cols = r === 4 ? rack4Cols : stdCols;
    const rows: RackRow[] = [];
    for (let row = 1; row <= maxRows; row++) {
      rows.push({
        num: row,
        slots: cols.map((c) => `${prefix}R${r}${c}${String(row).padStart(2, '0')}`),
      });
    }
    maps[`RACK ${r}`] = { cols, rows };
  }
  return maps;
}

export const B1_RACK_MAP: RackMap = generarMP('B1', ['Q', 'R', 'S', 'T', 'U', 'V'], 7, 10);
export const B2_RACK_MAP: RackMap = generarMP(
  'B2',
  ['Q', 'R', 'S', 'T', 'U', 'V', 'X'],
  4,
  12,
);

export function telaToQRContent(posicion: string, almacen: string | null | undefined): string {
  const ascii = (s: string | null | undefined) =>
    String(s ?? '')
      .trim()
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/\s+/g, '_');
  return `TEL_LOC:${ascii(posicion)}|${ascii(almacen)}`;
}
