import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parsearExcelFase0, validarFilaFase0, canonizar } from './importarExcelFase0';

// Encabezados tal cual la planilla "INFORMACIÓN DEL PRODUCTO".
const HEADER = [
  'COD', 'COD SEC', 'DIRECC. CAD/CIERRE', 'SENT. CORT', 'CANT', 'PRODUCTO',
  'COD_INT', 'TIPO', 'DESCRIPCIÓN', 'UBIC.', 'COLOR ACCESORIOS', 'ANCHO', 'ALTO',
];

function libro(filas: unknown[][], antesDelHeader: unknown[][] = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([...antesDelHeader, HEADER, ...filas]),
    'Hoja1',
  );
  return wb;
}

const OPTS = {
  codIntValidos: new Set(['BK 69', 'SC 68']),
  categorias: new Set(['ROL', 'ROL_DUAL']),
  direcciones: new Set(['CAD [IZQUIERDA]', 'CAD [DERECHA]']),
  sentidos: new Set(['INTERNO', 'EXTERNO']),
};

describe('parsearExcelFase0', () => {
  it('mapea las columnas llave e ignora COD/PRODUCTO/TIPO/DESCRIPCIÓN', () => {
    const wb = libro([
      ['BLACKOUT_D', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', 1, 'ROLLER BLACKOUT', 'BK 69', 'DELUX', 'GRIS TEXTURADO', 'LIVING A-G1', 'GRIS', '2,720', '1,600'],
    ]);
    const { cortinas, adicionales } = parsearExcelFase0(wb);
    expect(adicionales).toEqual([]);
    expect(cortinas).toHaveLength(1);
    expect(cortinas[0]).toEqual({
      codInt: 'BK 69',
      categoria: 'ROL',
      direccion: 'CAD [IZQUIERDA]',
      sentido: 'EXTERNO',
      cantidad: 1,
      ubicacion: 'LIVING A-G1',
      colorAcc: 'GRIS',
      ancho: 2.72,
      alto: 1.6,
    });
  });

  it('interpreta la coma como decimal (metros es-CL) y acepta números nativos', () => {
    const wb = libro([
      ['', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', 1, '', 'BK 69', '', '', 'A', 'GRIS', '0,520', 1.6],
      ['', 'ROL', 'CAD [DERECHA]', 'EXTERNO', 1, '', 'BK 69', '', '', 'B', 'GRIS', '1.234,50', '2,00'],
    ]);
    const { cortinas } = parsearExcelFase0(wb);
    expect(cortinas[0].ancho).toBe(0.52);
    expect(cortinas[0].alto).toBe(1.6);
    expect(cortinas[1].ancho).toBe(1234.5); // punto = miles, coma = decimal
    expect(cortinas[1].alto).toBe(2);
  });

  it('detecta el header aunque haya filas de título arriba y salta filas vacías', () => {
    const wb = libro(
      [
        ['BLACKOUT_D', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', 1, 'X', 'BK 69', 'DELUX', 'd', 'A', 'GRIS', '2,72', '1,6'],
        [null, null, null, null, null, null, null, null, null, null, null, null, null],
      ],
      [['INFORMACIÓN DEL PRODUCTO'], ['Cotización N° 123']],
    );
    const { cortinas } = parsearExcelFase0(wb);
    expect(cortinas).toHaveLength(1);
    expect(cortinas[0].codInt).toBe('BK 69');
  });

  it('cantidad por defecto 1 cuando viene vacía o < 1', () => {
    const wb = libro([
      ['', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', '', '', 'BK 69', '', '', 'A', 'GRIS', '2,72', '1,6'],
    ]);
    expect(parsearExcelFase0(wb).cortinas[0].cantidad).toBe(1);
  });

  it('separa cortinas de adicionales usando el rótulo "ADICIONALES"', () => {
    const wb = libro([
      ['BLACKOUT_D', 'ROL', 'CAD [DERECHA]', 'INTERNO', 1, 'ROLLER BLACKOUT DELUX', 'BK 60', 'DELUX', 'PEACE', 'LIVING-G1', 'BLANCO', '2,690', '2,320'],
      ['ADICIONALES'],
      ['INSTALACION', '', '', '', 3, 'INSTALACION ROLLER', 'INST', 'INSTALACION', 'GRATIS', '', '', '', ''],
      // Cenefa: la cantidad útil es CANT (2,694 = decimal); el ANCHO se ignora.
      ['ACCESORIO', '', '', '', '2,694', 'CENEFA CUADRADA', 'CENF C', 'ACCESORIO', 'CENEFA', 'LIVING', 'CAFÉ', '2,694', ''],
    ]);
    const { cortinas, adicionales } = parsearExcelFase0(wb);
    expect(cortinas).toHaveLength(1);
    expect(cortinas[0].codInt).toBe('BK 60');
    expect(adicionales).toHaveLength(2);
    expect(adicionales[0]).toEqual({ codInt: 'INST', cantidad: 3, ubicacion: '', colorAcc: '' });
    // Cenefa: cantidad decimal desde CANT, color y ubicación; ancho ignorado.
    expect(adicionales[1]).toEqual({
      codInt: 'CENF C',
      cantidad: 2.694,
      ubicacion: 'LIVING',
      colorAcc: 'CAFÉ',
    });
  });

  it('rescata el N° de OT manual del encabezado ("OT CLIENTE: 3085")', () => {
    const wb = libro(
      [['', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', 1, '', 'BK 69', '', '', 'A', 'GRIS', '2,72', '1,6']],
      [
        ['', 'COTIZACIÓN'],
        // Como el Formato de Cotización real: rótulo, número (numérico) y
        // "FECHA COTIZACIÓN" más a la derecha en la misma fila.
        ['', 'NOMBRE:', '', 'JEFERSON', '', 'OT CLIENTE:', 3085, null, 'FECHA COTIZACIÓN'],
      ],
    );
    expect(parsearExcelFase0(wb).otCliente).toBe('3085');
  });

  it('sin "OT CLIENTE" (o con la celda del número vacía) devuelve otCliente vacío', () => {
    const fila = ['', 'ROL', 'CAD [IZQUIERDA]', 'EXTERNO', 1, '', 'BK 69', '', '', 'A', 'GRIS', '2,72', '1,6'];
    expect(parsearExcelFase0(libro([fila])).otCliente).toBe('');
    // Celda del número vacía: NO debe tragarse el rótulo "FECHA COTIZACIÓN".
    const wb = libro([fila], [['', 'OT CLIENTE:', null, null, 'FECHA COTIZACIÓN']]);
    expect(parsearExcelFase0(wb).otCliente).toBe('');
  });

  it('si la primera hoja no tiene la tabla, la busca en las demás (.xlsm maestro)', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['NUMERO', 'ESTILO', 'ANCHO', 'ALTO'], [1, 'SCREEN', 1.2, 2.3]]),
      'Hoja1',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['', 'OT CLIENTE:', '3085-B'],
        HEADER,
        ['', 'ROL', 'CAD [DERECHA]', 'INTERNO', 1, '', 'BK 69', '', '', 'A', 'GRIS', '2,72', '1,6'],
      ]),
      'Formato de Cotizacion',
    );
    const { cortinas, otCliente } = parsearExcelFase0(wb);
    expect(cortinas).toHaveLength(1);
    expect(cortinas[0].codInt).toBe('BK 69');
    expect(otCliente).toBe('3085-B');
  });

  it('los adicionales sin COD_INT se descartan (filas vacías de relleno)', () => {
    const wb = libro([
      ['BLACKOUT_D', 'ROL', 'CAD [DERECHA]', 'INTERNO', 1, 'X', 'BK 69', 'DELUX', 'd', 'A', 'GRIS', '2,69', '2,32'],
      ['ADICIONALES'],
      ['', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]);
    const { cortinas, adicionales } = parsearExcelFase0(wb);
    expect(cortinas).toHaveLength(1);
    expect(adicionales).toEqual([]);
  });
});

describe('validarFilaFase0', () => {
  const base = {
    codInt: 'BK 69', categoria: 'ROL', direccion: 'CAD [IZQUIERDA]',
    sentido: 'EXTERNO', cantidad: 1, ubicacion: 'A', colorAcc: 'GRIS',
    ancho: 2.72, alto: 1.6,
  };

  it('fila correcta no tiene campos inválidos', () => {
    expect(validarFilaFase0(base, OPTS)).toEqual([]);
  });

  it('marca COD_INT inexistente', () => {
    expect(validarFilaFase0({ ...base, codInt: 'XX 99' }, OPTS)).toContain('codInt');
  });

  it('marca mecanismo/dirección/sentido fuera de lista y medidas ≤ 0', () => {
    const malos = validarFilaFase0(
      { ...base, categoria: 'NOPE', direccion: '', sentido: 'ZZZ', ancho: 0, alto: -1 },
      OPTS,
    );
    expect(malos.sort()).toEqual(['alto', 'ancho', 'categoria', 'direccion', 'sentido'].sort());
  });

  it('VERTICAL no exige sentido de caída (no se enrolla: corre de lado)', () => {
    const opts = { ...OPTS, categorias: new Set([...OPTS.categorias, 'VERTICAL']) };
    expect(validarFilaFase0({ ...base, categoria: 'VERTICAL', sentido: '' }, opts)).toEqual([]);
    // Y si el Excel igual trae un sentido, tampoco se marca (se ignora al importar).
    expect(validarFilaFase0({ ...base, categoria: 'VERTICAL', sentido: 'ZZZ' }, opts)).toEqual([]);
    // El resto de categorías lo sigue exigiendo.
    expect(validarFilaFase0({ ...base, sentido: '' }, opts)).toEqual(['sentido']);
  });
});

describe('canonizar', () => {
  it('recupera el valor canónico ignorando mayúsculas/acentos', () => {
    expect(canonizar('externo', ['INTERNO', 'EXTERNO'])).toBe('EXTERNO');
    expect(canonizar('cad [izquierda]', ['CAD [IZQUIERDA]'])).toBe('CAD [IZQUIERDA]');
  });

  it('devuelve el valor recortado si no coincide ninguna opción', () => {
    expect(canonizar('  raro ', ['ROL'])).toBe('raro');
  });
});
