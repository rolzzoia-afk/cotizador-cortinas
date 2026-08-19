import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parsearExcelFase0,
  validarFilaFase0,
  canonizar,
  categoriaImplicita,
} from './importarExcelFase0';

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
      // Columna exclusiva de la planilla beeblack: vacía en el formato estándar.
      // Ojo: el TIPO de esta planilla dice DELUX, no SIMPLE/DOBLE → se ignora.
      tipoSimpleDoble: '',
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
    ancho: 2.72, alto: 1.6, tipoSimpleDoble: '',
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
    // La vertical SÍ lleva cierre: la dirección se sigue exigiendo.
    expect(validarFilaFase0({ ...base, categoria: 'VERTICAL', direccion: '' }, opts)).toEqual([
      'direccion',
    ]);
  });

  it('PLETINA (velcro) no exige NI dirección NI sentido: va pegada, sin cadena', () => {
    const opts = {
      ...OPTS,
      categorias: new Set([...OPTS.categorias, 'PLETINA_ROLLER_V', 'PLETINA_DUO_V']),
    };
    for (const categoria of ['PLETINA_ROLLER_V', 'PLETINA_DUO_V']) {
      expect(
        validarFilaFase0({ ...base, categoria, direccion: '', sentido: '' }, opts),
      ).toEqual([]);
      // Aunque la planilla traiga basura en esas columnas, tampoco se marca.
      expect(
        validarFilaFase0({ ...base, categoria, direccion: 'ZZZ', sentido: 'ZZZ' }, opts),
      ).toEqual([]);
    }
    // El COD_INT y las medidas se siguen exigiendo igual que a cualquier cortina.
    expect(
      validarFilaFase0(
        { ...base, categoria: 'PLETINA_ROLLER_V', codInt: 'XX 99', ancho: 0 },
        opts,
      ).sort(),
    ).toEqual(['ancho', 'codInt']);
  });

  it('un tipo propio con base PLETINA también queda exento (resuelve por `tipos`)', () => {
    const opts = {
      ...OPTS,
      categorias: new Set([...OPTS.categorias, 'VELCRO_COCINA']),
      tipos: [
        {
          categoria: 'VELCRO_COCINA',
          nombre: 'Velcro cocina',
          grupo: 'Pletina',
          base: 'PLETINA_ROLLER_V',
          activo: true,
        },
      ],
    };
    expect(
      validarFilaFase0({ ...base, categoria: 'VELCRO_COCINA', direccion: '', sentido: '' }, opts),
    ).toEqual([]);
  });

  // Fase 1 (cotización de entrada) OCULTA las columnas COD SEC / DIRECC. / SENT.:
  // marcarlas dejaba la importación trabada — la celda roja no se puede corregir
  // sin su columna en pantalla, y el guardado se bloquea mientras haya errores.
  describe('modo fase1 (columnas reducidas)', () => {
    const fase1 = { ...OPTS, modo: 'fase1' as const };

    it('la planilla mínima (COD_INT + medidas) importa sin nada en rojo', () => {
      const minima = { ...base, categoria: '', direccion: '', sentido: '' };
      expect(validarFilaFase0(minima, fase1)).toEqual([]);
      // En Fase 3, esa misma fila sí reclama las tres columnas.
      expect(validarFilaFase0(minima, OPTS).sort()).toEqual(
        ['categoria', 'direccion', 'sentido'].sort(),
      );
    });

    it('sigue exigiendo lo que Fase 1 SÍ muestra: COD_INT, ancho y alto', () => {
      expect(
        validarFilaFase0({ ...base, codInt: 'XX 99', ancho: 0, alto: -1 }, fase1).sort(),
      ).toEqual(['alto', 'ancho', 'codInt'].sort());
    });
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

// La planilla real de beeblack ("COTIZACIÓN … BEEBLACK") renombra tres columnas
// en las mismas posiciones: COD SEC → TIPO DE INSTALACIÓN, DIRECC. CAD/CIERRE →
// CIERRE y SENT. CORT → TIPO (SIMPLE|DOBLE). El TIPO de PREMIUM/DELUX sigue ahí.
const HEADER_BEEBLACK = [
  'COD', 'TIPO DE INSTALACIÓN', 'CIERRE', 'TIPO', 'CANT', 'PRODUCTO',
  'COD_INT', 'TIPO', 'DESCRIPCIÓN', 'UBIC.', 'COLOR ACCESORIOS', 'ANCHO', 'ALTO',
];

function libroBeeblack(filas: unknown[][]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER_BEEBLACK, ...filas]), 'Hoja1');
  return wb;
}

describe('parsearExcelFase0 — planilla BEEBLACK', () => {
  it('lee CIERRE y TIPO (SIMPLE/DOBLE) de sus columnas propias', () => {
    const wb = libroBeeblack([
      ['', 'DENTRO_DEL_MARCO', 'IZQUIERDA-DERECHA', 'DOBLE', 1, 'BEEBLACK-MOSQUITERO',
       'BEE-SC', 'PREMIUM', 'K-108S', 'DORMITORIO', 'NEGRO', '2,000', '1,300'],
    ]);
    const { cortinas } = parsearExcelFase0(wb);
    expect(cortinas[0]).toMatchObject({
      codInt: 'BEE-SC',
      direccion: 'IZQUIERDA-DERECHA',
      tipoSimpleDoble: 'DOBLE',
      ancho: 2,
      alto: 1.3,
    });
    // Sin COD SEC, la categoría queda vacía y la deduce el importador.
    expect(cortinas[0].categoria).toBe('');
  });

  it('la columna TIPO DE INSTALACIÓN se ignora: sus 5 valores no son los reales', () => {
    const wb = libroBeeblack([
      ['', 'PISO_TECHO_PERFIL_MEDIO', 'IZQUIERDA-DERECHA', 'SIMPLE', 1, 'BEEBLACK-BLACKOUT',
       'BEE-BK', 'PREMIUM', 'FB-2589', 'LIVING', 'NEGRO', '2,000', '1,300'],
    ]);
    const fila = parsearExcelFase0(wb).cortinas[0];
    // La instalación real (dentro del marco / techo a muro / fuera del marco) se
    // elige en Fase 2, junto a la variante.
    expect(Object.keys(fila)).not.toContain('instalacion');
    // Y no contamina ningún otro campo de la fila.
    expect(fila.categoria).toBe('');
    expect(fila.direccion).toBe('IZQUIERDA-DERECHA');
  });

  it('la segunda columna TIPO (PREMIUM/DELUX) no se confunde con SIMPLE/DOBLE', () => {
    const wb = libroBeeblack([
      ['', 'FUERA_DEL_MARCO', 'DE ARRIBA ABAJO', '', 1, 'BEEBLACK-BLACKOUT',
       'BEE-BK', 'PREMIUM', 'FB-2589', 'LIVING', 'NEGRO', '2,000', '1,300'],
    ]);
    expect(parsearExcelFase0(wb).cortinas[0].tipoSimpleDoble).toBe('');
  });

  it('categoriaImplicita deduce BEEBLACK de los códigos BEE-*', () => {
    expect(categoriaImplicita('BEE-BK')).toBe('BEEBLACK');
    expect(categoriaImplicita('BEE-SC04')).toBe('BEEBLACK');
    expect(categoriaImplicita('BK 69')).toBe('');
    expect(categoriaImplicita('')).toBe('');
    expect(categoriaImplicita(undefined)).toBe('');
  });
});

describe('validarFilaFase0 — BEEBLACK', () => {
  const opts = {
    ...OPTS,
    categorias: new Set([...OPTS.categorias, 'BEEBLACK']),
    codIntValidos: new Set([...OPTS.codIntValidos, 'BEE-SC']),
    direccionesBeeblack: new Set(['IZQUIERDA-DERECHA', 'DERECHA-IZQUIERDA', 'DE ARRIBA ABAJO']),
  };
  const bb = {
    codInt: 'BEE-SC', categoria: 'BEEBLACK', direccion: 'DE ARRIBA ABAJO', sentido: '',
    cantidad: 1, ubicacion: 'DORM', colorAcc: 'NEGRO', ancho: 2, alto: 1.3,
    tipoSimpleDoble: 'DOBLE',
  };

  it('acepta sus cierres propios y no exige SENT. CORT', () => {
    expect(validarFilaFase0(bb, opts)).toEqual([]);
    expect(validarFilaFase0({ ...bb, direccion: 'IZQUIERDA-DERECHA' }, opts)).toEqual([]);
  });

  it('un cierre de roller NO vale en beeblack (y viceversa)', () => {
    expect(validarFilaFase0({ ...bb, direccion: 'CAD [IZQUIERDA]' }, opts)).toContain('direccion');
    expect(
      validarFilaFase0({ ...bb, categoria: 'ROL', codInt: 'BK 69', sentido: 'INTERNO' }, opts),
    ).toContain('direccion');
  });
});

describe('parsearExcelFase0 — beeblack en la planilla ESTÁNDAR', () => {
  it('el marcador DOBLE se acepta en SENT. CORT (que el beeblack no usa)', () => {
    const wb = libro([
      ['', 'BEEBLACK', 'IZQUIERDA-DERECHA', 'DOBLE', 1, '', 'BEE-BK', 'PREMIUM', '',
       'DORM', 'NEGRO', '1,600', '1,300'],
    ]);
    const f = parsearExcelFase0(wb).cortinas[0];
    expect(f.tipoSimpleDoble).toBe('DOBLE');
    expect(f.sentido).toBe(''); // 'DOBLE' no es una caída: no queda en rojo
    expect(f.categoria).toBe('BEEBLACK');
  });

  it('un SENT. CORT normal sigue intacto', () => {
    const wb = libro([
      ['', 'ROL', 'CAD [DERECHA]', 'INTERNO', 1, '', 'BK 69', 'DELUX', '', 'A', 'GRIS', '2,72', '1,6'],
    ]);
    const f = parsearExcelFase0(wb).cortinas[0];
    expect(f.sentido).toBe('INTERNO');
    expect(f.tipoSimpleDoble).toBe('');
  });
});
