import { describe, expect, it } from 'vitest';
import { construirInventario, notasTerreno } from './pdfInventario';
import { REGLAS_SELECCION_DEFAULT } from '@/modules/descuentos/reglasSeleccion';
import type { Pano, Ventana } from '@/modules/cotizador/types';

const modeloCenefa = {
  sistema: 'CENEFA_OVALADA',
  tipo_rol: 'ROL_MANUAL_CENEFA_OV',
  mecanismo: 'MEC_09_OVALADA_NEGRO',
  diametro_tubo_mm: 38,
  codigos_tubo: 'E02;E66',
  dcto_tubo_cm: 1.8,
  dcto_cenefa_cm: 1.5,
  suma_peso_cm: 0.1,
};

function ventana(ubic: string, ancho: number, alto: number): Ventana {
  return {
    id: ubic,
    ubicacion: ubic,
    codInt: 'SC34',
    producto: 'ROLLER SCREEN PREMIUM',
    categoria: 'ROL',
    modelo: modeloCenefa,
    panos: [
      {
        ancho,
        alto,
        color: 'NEGRO',
        codCadena: 'CAD 03',
        largoCadena: '4mts',
        codPeso: 'PCA04',
        colorPeso: 'NEG', // color de accesorios; el peso PCA04 es TRANSPARENTE igual
      },
    ],
  } as unknown as Ventana;
}

describe('construirInventario', () => {
  const ventanas = [
    ventana('OFICINA IZQ-G1', 1.565, 2.476),
    ventana('OFICINA DER-G1', 1.189, 2.476),
  ];
  const data = construirInventario(ventanas);

  it('una fila por cortina con identidad y medidas a 3 decimales', () => {
    expect(data.filas).toHaveLength(2);
    const f = data.filas[0];
    expect(f.producto).toBe('ROLLER SCREEN PREMIUM');
    expect(f.tipo).toBe('ROL_MANUAL_CENEFA_OV');
    // Kit de bodega resuelto por color (NEG → MEC 32), igual que la hoja de
    // Fase 4 — NO el id del modelo Excel (MEC_09_OVALADA_NEGRO).
    expect(f.codMecanismo).toBe('KIT SIMPLE NEGRO 38MM [MEC 32]');
    // Descripción larga de la cadena (código sin espacios + nombre + color).
    expect(f.accionamiento).toBe('[CAD03] CADENA INFINITA 4 METROS');
    // Peso con descripción completa del insumo (no el color de accesorios).
    expect(f.pesoCadena).toBe('[PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM');
    // Tubería con descripción larga por código (38 mm ≤2,2 m → E02).
    expect(f.tuberia).toBe('E02-TUBO 1.2 / Ø 38 mm');
    expect(f.ubic).toBe('OFICINA IZQ-G1');
    expect(f.anchoMts).toBe('1,565');
    expect(f.altoMts).toBe('2,476');
  });

  it('ya no arma la tabla de materiales consolidados (CORTINAS ROLLER eliminada)', () => {
    expect('materiales' in data).toBe(false);
  });

  it('roller emite tapas + tornillos + mecanismo + cadena + peso, clasificados por grupo', () => {
    // 2 cortinas roller NEG: TAP04/05 (×2), TOR02 (2/paño=4), y MEC/CAD/PCA por paño.
    const map = Object.fromEntries(data.insumos.map((i) => [i.codigo, i.cantidad]));
    expect(map.TAP04).toBe(2);
    expect(map.TAP05).toBe(2);
    expect(map.TOR02).toBe(4);
    expect(map.MEC32).toBe(2);
    expect(map['CAD 03']).toBe(2);
    expect(map.PCA04).toBe(2);
    // INSUMOS (bodega): tapas + tornillos. INSTALACIÓN: cadena, peso y kit simple.
    const grupo = (c: string) => data.insumos.find((i) => i.codigo === c)?.grupo;
    expect(grupo('TAP04')).toBe('INSUMOS');
    expect(grupo('TOR02')).toBe('INSUMOS');
    expect(grupo('CAD 03')).toBe('INSTALACION');
    expect(grupo('PCA04')).toBe('INSTALACION');
    expect(grupo('MEC32')).toBe('INSTALACION');
  });

  it('topes de cadena: 2 por cortina, por color de accesorios, en la tabla INSUMOS', () => {
    // 2 cortinas negras → TOP05 ×4. Van con las tapas y los tornillos, que es
    // donde el taller espera los topes, no con la cadena en INSTALACIÓN.
    const top = data.insumos.find((i) => i.codigo === 'TOP05');
    expect(top?.cantidad).toBe(4);
    expect(top?.grupo).toBe('INSUMOS');
    expect(top?.descripcion).toBe('[TOP05] TOPES NEGROS - ROLZZO');
  });

  it('el tope elegido a mano en Fase 2 le gana al del color', () => {
    const v = ventana('LIVING', 1.5, 2.0); // accesorios NEGRO → TOP05 por defecto
    (v.panos![0] as { codTope?: string }).codTope = 'TOP06';
    const d = construirInventario([v]);
    expect(d.insumos.find((i) => i.codigo === 'TOP06')?.cantidad).toBe(2);
    expect(d.insumos.some((i) => i.codigo === 'TOP05')).toBe(false);
  });

  it('PLETINA y BEEBLACK no llevan topes (no llevan cadena)', () => {
    for (const categoria of ['PLETINA_ROLLER_V', 'BEEBLACK_ESTANDAR']) {
      const v = ventana('LIVING', 1.5, 2.0);
      (v as { categoria: string }).categoria = categoria;
      const d = construirInventario([v]);
      expect(d.insumos.some((i) => (i.codigo || '').startsWith('TOP'))).toBe(false);
    }
  });

  it('esta hoja usa el catálogo de colores, igual que el cuadro COMPONENTES', () => {
    // Antes `consolidarInsumos` llamaba a `insumosDePano` sin el catálogo: un
    // color dado de alta en Admin salía acá con el código de fábrica mientras
    // el BOM mostraba el suyo. Las dos salidas tienen que decir lo mismo.
    const v = ventana('LIVING', 1.5, 2.0);
    (v.panos![0] as { color?: string }).color = 'NEG';
    const reglas = {
      ...REGLAS_SELECCION_DEFAULT,
      colores: [
        { codigo: 'NEG', nombre: 'NEGRO', usos: {}, insumos: { topeCadena: 'TOP99', tapaPesoIzq: 'TAP99' } },
      ],
    } as unknown as Parameters<typeof construirInventario>[7];
    const d = construirInventario([v], {}, undefined, [], false, undefined, undefined, reglas);
    expect(d.insumos.find((i) => i.codigo === 'TOP99')?.cantidad).toBe(2);
    expect(d.insumos.some((i) => i.codigo === 'TAP99')).toBe(true);
  });

  it('etiquetas: 1 por cortina, código según color de accesorios (NEG → INS 95 negra)', () => {
    expect(data.etiquetas).toEqual([{ cod: 'INS 95', color: 'NEGRA', cantidad: 2 }]);
  });

  it('incluye las notas de terreno (vacías si nadie anotó nada)', () => {
    expect(data.notas).toEqual([]);
  });

  it('sin peso de cadena elegido en Fase 2 (sin codPeso) → celda PESO CADENA vacía', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    // Sin codPeso, aunque el sync haya dejado un colorPeso de accesorios.
    delete (v.panos![0] as { codPeso?: string }).codPeso;
    (v.panos![0] as { colorPeso?: string }).colorPeso = 'GRS';
    const d = construirInventario([v]);
    expect(d.filas[0].pesoCadena).toBe('');
  });

  it('sin codPeso guardado → igual emite el peso PCA04 (fijo, va a instalación)', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    delete (v.panos![0] as { codPeso?: string }).codPeso; // OT no sincronizada en Fase 2
    const d = construirInventario([v]);
    const pca = d.insumos.find((i) => i.codigo === 'PCA04');
    expect(pca?.cantidad).toBe(1);
    expect(pca?.grupo).toBe('INSTALACION');
    expect(pca?.descripcion).toBe('[PCA04] PESO PORTA CADENA TRANSPARENTE / CUADRADA 7.5 CM');
  });

  it('sin codCadena guardado → resuelve la cadena por alto + color con el catálogo', () => {
    const v = ventana('LIVING', 1.5, 2.0); // paño NEGRO, alto 2,0 → cadena 4 m
    delete (v.panos![0] as { codCadena?: string }).codCadena; // OT no sincronizada en Fase 2
    const cadenas = [
      { cod: 'CAD05', nemotecnico: 'CADENA INFINITA 4 METROS NEGRA', color: 'NEGRO', status: 'OK' },
    ];
    const d = construirInventario([v], {}, undefined, cadenas);
    const cad = d.insumos.find((i) => i.codigo === 'CAD05');
    expect(cad?.cantidad).toBe(1);
    expect(cad?.grupo).toBe('INSTALACION');
    expect(cad?.descripcion).toBe('[CAD05] CADENA INFINITA 4 METROS NEGRO');
  });

  it('sin codCadena y sin catálogo de cadenas → no inventa cadena (queda sin línea)', () => {
    const v = ventana('LIVING', 1.5, 2.0);
    delete (v.panos![0] as { codCadena?: string }).codCadena;
    const d = construirInventario([v]); // sin catálogo de cadenas
    expect(d.insumos.some((i) => (i.codigo || '').startsWith('CAD'))).toBe(false);
  });

  it('PLETINA (velcro): ni cadena ni peso de cadena, aunque el paño los traiga', () => {
    // El velcro tiene mecanismo (VELCRO) pero el paño va PEGADO: no sube ni baja.
    // Ojo: el peso se emite EN VIVO (no depende del `codPeso` guardado), así que
    // sin este gate la hoja pedía un PCA04 que nadie usa.
    const v = ventana('LIVING', 1.5, 2.0);
    (v as { categoria: string }).categoria = 'PLETINA_ROLLER_V';
    const cadenas = [
      { cod: 'CAD05', nemotecnico: 'CADENA INFINITA 4 METROS NEGRA', color: 'NEGRO', status: 'OK' },
    ];
    const d = construirInventario([v], {}, undefined, cadenas);
    expect(d.insumos.some((i) => (i.codigo || '').startsWith('CAD'))).toBe(false);
    expect(d.insumos.some((i) => (i.codigo || '').startsWith('PCA'))).toBe(false);
  });
});

// Las manillas se consolidan por color al inicio del bloque INSUMOS, seguidas
// del resto de insumos (tapas de peso, tornillos…).
describe('construirInventario — bloque INSUMOS', () => {
  const vMan = (ubic: string, cant: number, color: string): Ventana =>
    ({
      id: ubic,
      ubicacion: ubic,
      producto: 'ROLLER SCREEN PREMIUM',
      categoria: 'ROL',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'NEGRO', manillaCant: cant, manillaColor: color }],
    }) as unknown as Ventana;

  it('las manillas van primero, consolidadas por color (CAFÉ ×9, NEG ×2)', () => {
    const d = construirInventario([
      vMan('A', 4, 'CAFÉ'),
      vMan('B', 5, 'CAFÉ'),
      vMan('C', 2, 'NEG'),
    ]);
    expect(d.insumos.slice(0, 2)).toEqual([
      { id: 1, codigo: 'HER49', descripcion: '[HER49] MANILLA PLANA CAFE', cantidad: 9, grupo: 'INSTALACION' },
      { id: 2, codigo: 'HER47', descripcion: '[HER47] MANILLA PLANA NEGRO', cantidad: 2, grupo: 'INSTALACION' },
    ]);
  });

  it('cenefa cuadrada CON_2_TAPAS → "[TAP32] TAPA CENEFA CUADRADA NEGRO" ×2 + brackets', () => {
    const v = {
      id: 'x',
      ubicacion: 'LIVING',
      producto: 'ROLLER BLACKOUT',
      categoria: 'ROL',
      color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{
        ancho: 1.5, alto: 2.0, color: 'BLANCO',
        cenefa: 'Cuadrada a techo', cenefaTapa: 'CON_2_TAPAS', colorTapa: 'NEG',
      }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const tapa = d.insumos.find((i) => i.codigo === 'TAP32');
    expect(tapa?.descripcion).toBe('[TAP32] TAPA CENEFA CUADRADA NEGRO');
    expect(tapa?.cantidad).toBe(2);
    expect(tapa?.grupo).toBe('INSTALACION'); // tapa cenefa cuadrada → instalación pese a código TAP
    // Cenefa cuadrada a techo → BRA04 × cantidadBrackets(1,5) = 3, instalación.
    const bra = d.insumos.find((i) => i.codigo === 'BRA04');
    expect(bra?.cantidad).toBe(3);
    expect(bra?.grupo).toBe('INSTALACION');
  });

  it('tapa cenefa cuadrada: código por color (BCO→TAP33, CAFÉ→TAP34); color desconocido sin código', () => {
    const mk = (colorTapa: string) =>
      ({
        id: 'c' + colorTapa, ubicacion: 'LIVING', producto: 'ROLLER BLACKOUT', categoria: 'ROL', color: 'BLANCO',
        modelo: modeloCenefa,
        panos: [{ ancho: 1.2, alto: 2.0, cenefa: 'Cuadrada a muro', cenefaTapa: 'CON_1_TAPA', colorTapa }],
      }) as unknown as Ventana;
    const bco = construirInventario([mk('BCO')]).insumos.find((i) => i.codigo === 'TAP33');
    expect(bco?.descripcion).toBe('[TAP33] TAPA CENEFA CUADRADA BLANCO');
    expect(bco?.grupo).toBe('INSTALACION');
    const cafe = construirInventario([mk('CAFÉ')]).insumos.find((i) => i.codigo === 'TAP34');
    expect(cafe?.descripcion).toBe('[TAP34] TAPA CENEFA CUADRADA CAFÉ');
    expect(cafe?.grupo).toBe('INSTALACION');
    // Defensivo: un color fuera de catálogo (dato legacy) sale sin código, igual
    // en instalación. La tapa cuadrada solo existe en negro/blanco/café.
    const otro = construirInventario([mk('VERDE')]).insumos.find((i) =>
      i.descripcion.includes('TAPA CENEFA CUADRADA'),
    );
    expect(otro?.codigo).toBeUndefined();
    expect(otro?.grupo).toBe('INSTALACION');
  });

  it('DARK: cenefa cuadrada IMPLÍCITA → 2 tapas por color de accesorios + BRA05 muro', () => {
    const modeloDark = {
      sistema: 'DARK_ROLLER', tipo_rol: 'DARK_INTERNO_38mm', mecanismo: '',
      diametro_tubo_mm: 38, codigos_tubo: 'E02;E66',
    };
    const mk = (colorAcc: string) =>
      ({
        id: 'd' + colorAcc, ubicacion: 'LIVING', producto: 'ROLLER BLACKOUT',
        categoria: 'DARK_38mm', color: colorAcc, modelo: modeloDark,
        // Sin cenefa (viene implícita); material vulcanita para exigir tarugos.
        panos: [{ ancho: 2.0, alto: 2.3, color: colorAcc, colorMecanismo: colorAcc, materialTipo: 'VULCANITA' }],
      }) as unknown as Ventana;
    const blanco = construirInventario([mk('BLANCO')]);
    const tapaB = blanco.insumos.find((i) => i.codigo === 'TAP33');
    expect(tapaB?.descripcion).toBe('[TAP33] TAPA CENEFA CUADRADA BLANCO');
    expect(tapaB?.cantidad).toBe(2); // SIEMPRE 2 en DARK
    expect(tapaB?.grupo).toBe('INSTALACION');
    // Cenefa cuadrada a muro (default) → BRA05 × cantidadBrackets(2,0)=4.
    const bra = blanco.insumos.find((i) => i.codigo === 'BRA05');
    expect(bra?.cantidad).toBe(4);
    expect(bra?.grupo).toBe('INSTALACION');
    // Tarugos vulcanita: 1 por bracket = 4.
    const tar = blanco.insumos.find((i) => i.codigo === 'TAR01');
    expect(tar?.cantidad).toBe(4);
    // Negro → TAP32.
    const tapaN = construirInventario([mk('NEGRO')]).insumos.find((i) => i.codigo === 'TAP32');
    expect(tapaN?.cantidad).toBe(2);
  });

  it('SOFT LIGHT CC: cenefa cuadrada → 2 tapas por color de accesorios aunque no se elija cenefaTapa', () => {
    const modeloSL = {
      sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_INTERNO_38mm', mecanismo: '',
      diametro_tubo_mm: 38, codigos_tubo: 'E02;E66',
    };
    const mk = (colorAcc: string) =>
      ({
        id: 's' + colorAcc, ubicacion: 'PIEZA', producto: 'ROLLER BLACKOUT',
        categoria: 'SOFT_LIGHT_38mm', color: colorAcc, modelo: modeloSL,
        // Cenefa cuadrada a muro SIN cenefaTapa elegido → igual salen 2 fijas.
        panos: [{ ancho: 2.0, alto: 2.0, color: colorAcc, colorMecanismo: colorAcc, cenefa: 'Cuadrada a muro' }],
      }) as unknown as Ventana;
    const blanco = construirInventario([mk('BLANCO')]);
    const tapaB = blanco.insumos.find((i) => i.codigo === 'TAP33');
    expect(tapaB?.cantidad).toBe(2); // SIEMPRE 2, como DARK
    expect(tapaB?.grupo).toBe('INSTALACION');
    expect(blanco.insumos.find((i) => i.codigo === 'BRA05')?.cantidad).toBe(4); // muro, ancho 2,0
    // Negro → TAP32 ×2.
    expect(construirInventario([mk('NEGRO')]).insumos.find((i) => i.codigo === 'TAP32')?.cantidad).toBe(2);
  });

  it('OSCURANTI: cenefa cuadrada IMPLÍCITA → 2 tapas color accesorios + BRA05 + tarugos', () => {
    const modeloOsc = {
      sistema: 'OSCURANTI', tipo_rol: 'OSCURANTI_INTERNO_63mm', mecanismo: '',
      diametro_tubo_mm: 63, codigos_tubo: 'E47',
    };
    const mk = (colorAcc: string) =>
      ({
        id: 'o' + colorAcc, ubicacion: 'LIVING', producto: 'ROLLER BLACKOUT',
        categoria: 'OSCURANTI_63mm', color: colorAcc, modelo: modeloOsc,
        // Sin cenefa elegida (es implícita, como DARK); vulcanita para exigir tarugos.
        panos: [{ ancho: 2.0, alto: 2.3, color: colorAcc, colorMecanismo: colorAcc, materialTipo: 'VULCANITA' }],
      }) as unknown as Ventana;
    const blanco = construirInventario([mk('BLANCO')]);
    const tapaB = blanco.insumos.find((i) => i.codigo === 'TAP33');
    expect(tapaB?.cantidad).toBe(2); // SIEMPRE 2, como DARK
    expect(tapaB?.grupo).toBe('INSTALACION');
    expect(blanco.insumos.find((i) => i.codigo === 'BRA05')?.cantidad).toBe(4);
    expect(blanco.insumos.find((i) => i.codigo === 'TAR01')?.cantidad).toBe(4);
    // Tapas de peso de oscuridad (a presión, 2 por paño) sin regresión.
    expect(blanco.insumos.find((i) => i.codigo === 'TAP26')?.cantidad).toBe(2);
    // Negro → TAP32 ×2.
    expect(construirInventario([mk('NEGRO')]).insumos.find((i) => i.codigo === 'TAP32')?.cantidad).toBe(2);
  });

  it('roller con cenefa cuadrada SIGUE el selector cenefaTapa (regresión, no fijas)', () => {
    const v = {
      id: 'r', ubicacion: 'SALA', producto: 'ROLLER', categoria: 'ROL', color: 'CAFÉ', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'CAFÉ', cenefa: 'Cuadrada a muro', colorTapa: 'CAFÉ', cenefaTapa: 'CON_1_TAPA' }],
    } as unknown as Ventana;
    const tap = construirInventario([v]).insumos.find((i) => i.codigo === 'TAP34');
    expect(tap?.cantidad).toBe(1); // 1 según el selector, NO 2 fijas
  });

  it('motor DOM41 + domótica (sin ovalada) → kit DOM en INSTALACIÓN; el hub sale de lo vendido', () => {
    const v = {
      id: 'm', ubicacion: 'DORM', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM41', motorDomotica: true, motorControlAdicCant: 1 }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const codes = d.insumos.map((i) => i.codigo);
    expect(codes).toEqual(expect.arrayContaining(['DOM41', 'DOM42']));
    expect(codes).not.toContain('DOM34'); // #28: el DOM41 no lleva cable
    // Sin cargador elegido, el kit no trae hub propio ni su enchufe DOM04.
    expect(codes).not.toContain('DOM04');
    // Regla 2026-07-30: el hub y el router ya no son "1 por OT" por tener domótica;
    // salen de los DOM43 vendidos en Fase 1 (ver el bloque de top-up).
    expect(codes).not.toContain('DOM43');
    expect(codes).not.toContain('DOM05');
    // Sin cenefa ovalada, todo el kit va a INSTALACIÓN (incluido el motor).
    const grupo = (c: string) => d.insumos.find((i) => i.codigo === c)?.grupo;
    expect(grupo('DOM41')).toBe('INSTALACION');
    expect(grupo('DOM42')).toBe('INSTALACION');
  });

  it('1 hub vendido → DOM43 + su router DOM05 y su adaptador DOM33, en INSTALACIÓN', () => {
    const v = {
      id: 'm', ubicacion: 'DORM', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM41', motorDomotica: true }],
    } as unknown as Ventana;
    const d = construirInventario([v], {}, undefined, [], false, [
      { codInt: 'DOM 43', cantidad: 1, descuento: 0, ubicacion: 'DORM' },
    ]);
    const cant = (c: string) => d.insumos.find((i) => i.codigo === c)?.cantidad;
    const grupo = (c: string) => d.insumos.find((i) => i.codigo === c)?.grupo;
    expect(cant('DOM43')).toBe(1);
    expect(cant('DOM05')).toBe(1);
    expect(cant('DOM33')).toBe(1);
    expect(grupo('DOM05')).toBe('INSTALACION');
    expect(grupo('DOM33')).toBe('INSTALACION');
  });
});

describe('construirInventario — kit + cadena aunque haya motor (van dentro del precio)', () => {
  const modeloRol = {
    sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE', mecanismo: '',
    diametro_tubo_mm: 38, codigos_tubo: 'E02;E66', dcto_tubo_cm: 3.8, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
  };

  it('ROL manual con motor DOM38: emite kit MEC + cadena + PCA04 + kit de motor (hub solo si se elige)', () => {
    const v = {
      id: 'r', ubicacion: 'LIVING', producto: 'ROLLER SCREEN PREMIUM', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloRol,
      panos: [{ ancho: 1.5, alto: 1.8, color: 'BLANCO', codCadena: 'CAD 03', largoCadena: '4mts', codPeso: 'PCA04', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const codes = construirInventario([v]).insumos.map((i) => i.codigo ?? '');
    expect(codes.some((c) => c.startsWith('MEC'))).toBe(true); // BLANCO → MEC 33
    expect(codes.some((c) => c.startsWith('CAD'))).toBe(true);
    expect(codes).toContain('PCA04');
    // Kit de motor sin nada elegido: motor + cable. El control se pide en Fase 2.
    expect(codes).toEqual(expect.arrayContaining(['DOM38', 'DOM34']));
    expect(codes).not.toContain('DOM39');
    expect(codes).not.toContain('DOM43');
    expect(codes).not.toContain('DOM04');
    // Con hub DOM43 y 1 control elegidos en Fase 2, el kit los suma (+DOM04 del hub).
    const conHub = {
      ...v, id: 'r2',
      panos: [{ ...(v.panos![0] as object), motorCargador: 'DOM43', motorControlAdicCant: 1 }],
    } as unknown as Ventana;
    const codesHub = construirInventario([conHub]).insumos.map((i) => i.codigo ?? '');
    expect(codesHub).toEqual(expect.arrayContaining(['DOM38', 'DOM39', 'DOM34', 'DOM04', 'DOM43']));
    // El router DOM05 depende del flag de domótica, NO de elegir DOM43 como cargador.
    expect(codesHub).not.toContain('DOM05');
  });

  it('categoría vendida como motor (…_MOTOR_…): sin kit de mecanismo ni cadena, pero con su motor', () => {
    const v = {
      id: 'g', ubicacion: 'SALA', producto: 'ROLLER SCREEN PREMIUM', categoria: 'ROL_CENEFA_OVALADA_MOTOR_GRANDE',
      color: 'BLANCO', modelo: modeloCenefa,
      panos: [{ ancho: 1.8, alto: 2.0, color: 'BLANCO', cenefa: 'Ovalada', codCadena: 'CAD 03', codPeso: 'PCA04', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const codes = construirInventario([v]).insumos.map((i) => i.codigo ?? '');
    expect(codes.some((c) => c.startsWith('MEC'))).toBe(false);
    expect(codes.some((c) => c.startsWith('CAD'))).toBe(false);
    expect(codes).not.toContain('PCA04');
    expect(codes).toContain('DOM38'); // igual lleva su kit de motor
  });
});

describe('construirInventario — VERTICAL (insumos VER)', () => {
  const modeloVertical = {
    sistema: 'VERTICAL',
    tipo_rol: 'VERTICAL_LAMAS_89',
    diametro_tubo_mm: 0,
    dcto_tubo_cm: 1.8,
    dcto_perfiles_cm: 1.7,
  };
  const vVert = (color: string, materialTipo?: string): Ventana =>
    ({
      id: 'V', ubicacion: 'ROSSANA G1', producto: 'VERTICAL', categoria: 'VERTICAL', color,
      modelo: modeloVertical,
      panos: [{ ancho: 2.12, alto: 2.34, color, materialTipo }],
    }) as unknown as Ventana;

  it('blanco: PRODUCCIÓN (peso lama/sujetador) + ESTRUCTURA (peso cordón/carrito/cordón/kit/peso cadena) + INSTALACIÓN (bracket)', () => {
    const by = Object.fromEntries(construirInventario([vVert('BLANCO')]).insumos.map((i) => [i.codigo, i]));
    // ancho 2,12 → perfil 210,2 · varilla 208,5 · floor(/8) = 26, + 1 = 27 carritos; brackets = 4.
    // PRODUCCIÓN (montaje sobre la tela)
    expect(by.VER41).toMatchObject({ cantidad: 27, grupo: 'PRODUCCION' });
    expect(by.VER45).toMatchObject({ cantidad: 27, grupo: 'PRODUCCION' });
    // ESTRUCTURA (ferretería del sistema)
    expect(by.VER37).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' });
    expect(by.VER40).toMatchObject({ cantidad: 27, grupo: 'ESTRUCTURA' });
    expect(by.VER50).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' });
    expect(by.VER52).toMatchObject({ cantidad: 1, grupo: 'ESTRUCTURA' });
    // INSTALACIÓN
    expect(by.VER38).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' });
    // Cordón y cadena inferior → "CALCULAR" (cantidad 0 + unidad, se miden en terreno).
    expect(by.VER43).toMatchObject({ cantidad: 0, unidad: 'CALCULAR', grupo: 'ESTRUCTURA' });
    expect(by.VER39).toMatchObject({ cantidad: 0, unidad: 'CALCULAR', grupo: 'INSTALACION' });
  });

  it('negro: peso cordón + peso cadena consolidan a [VER64] ×2 en ESTRUCTURA; cordón VER59, sujetador VER56, cadena inferior VER58', () => {
    const by = Object.fromEntries(construirInventario([vVert('NEGRO')]).insumos.map((i) => [i.codigo, i]));
    expect(by.VER59?.unidad).toBe('CALCULAR');
    expect(by.VER56?.cantidad).toBe(27);
    expect(by.VER58?.unidad).toBe('CALCULAR');
    // El peso del cordón es VER64 (= peso de cadena): una sola línea consolidada ×2.
    expect(by.VER64).toMatchObject({ cantidad: 2, grupo: 'ESTRUCTURA' });
    // En negro ya no hay VER37 (peso cordón pasó a VER64).
    expect(by.VER37).toBeUndefined();
    // No aparecen las contrapartes blancas.
    expect(by.VER43).toBeUndefined();
    expect(by.VER45).toBeUndefined();
  });

  it('tarugos por bracket según material (vulcanita → TAR01 × 4) en INSUMOS', () => {
    const by = Object.fromEntries(construirInventario([vVert('BLANCO', 'VULCANITA')]).insumos.map((i) => [i.codigo, i]));
    expect(by.TAR01).toMatchObject({ cantidad: 4, grupo: 'INSUMOS' });
  });
});

// Cenefa ovalada: el motor y el mecanismo van a PRODUCCIÓN; el resto del kit de
// motor (control/cable/enchufe) sigue en INSTALACIÓN.
describe('construirInventario — clasificación por cenefa ovalada', () => {
  it('motor de cortina ovalada → PRODUCCIÓN; control/cable/enchufe → INSTALACIÓN', () => {
    const v = {
      id: 'ov', ubicacion: 'LIVING', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      // Con hub elegido (DOM43) para verificar el grupo del enchufe DOM04, y un
      // control pedido en Fase 2 (ya no sale solo con el motor).
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'OVALADA', motorModelo: 'DOM41', motorCargador: 'DOM43', motorControlAdicCant: 1 }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const grupo = (c: string) => d.insumos.find((i) => i.codigo === c)?.grupo;
    // DOM41 en cenefa ovalada degrada a DOM38 (Tronic Plus con cable).
    expect(grupo('DOM38')).toBe('PRODUCCION'); // el motor
    expect(grupo('DOM39')).toBe('INSTALACION'); // control
    expect(grupo('DOM34')).toBe('INSTALACION'); // cable
    expect(grupo('DOM04')).toBe('INSTALACION'); // enchufe del hub
  });

  it('mecanismo de cenefa ovalada → PRODUCCIÓN', () => {
    const v = {
      id: 'x', ubicacion: 'OFICINA', producto: 'ROLLER SCREEN PREMIUM', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      modelo: {
        sistema: 'ROLLER', tipo_rol: 'ROL_SIMPLE', mecanismo: 'MEC_10_OVALADA_BLANCO',
        diametro_tubo_mm: 38, codigos_tubo: 'E02', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const mec = d.insumos.find((i) => (i.codigo || '').startsWith('MEC'));
    expect(mec?.descripcion).toContain('OVALADA');
    expect(mec?.grupo).toBe('PRODUCCION');
  });

  it('cadena de una cortina ovalada → PRODUCCIÓN; su peso sigue en INSTALACIÓN', () => {
    const v = {
      id: 'x', ubicacion: 'PZA 1', producto: 'ROLLER SCREEN PREMIUM', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm',
      modelo: {
        sistema: 'ROLLER', tipo_rol: 'ROL_SIMPLE', mecanismo: 'MEC_10_OVALADA_BLANCO',
        diametro_tubo_mm: 38, codigos_tubo: 'E02', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{
        ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO',
        codCadena: 'CAD07', largoCadena: '4mts', colorCadena: 'BLANCO', codPeso: 'PCA04',
      }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(d.insumos.find((i) => i.codigo === 'CAD07')?.grupo).toBe('PRODUCCION');
    expect(d.insumos.find((i) => i.codigo === 'PCA04')?.grupo).toBe('INSTALACION');
  });

  it('mismo motor DOM38 en paño ovalado y en paño normal → dos filas, una por tabla', () => {
    const vOv = {
      id: 'a', ubicacion: 'A', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'OVALADA', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const vNorm = {
      id: 'b', ubicacion: 'B', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM38' }],
    } as unknown as Ventana;
    const d = construirInventario([vOv, vNorm]);
    const dom38 = d.insumos.filter((i) => i.codigo === 'DOM38');
    expect(dom38).toHaveLength(2); // NO se consolidan entre tablas
    expect(dom38.map((i) => i.grupo).sort()).toEqual(['INSTALACION', 'PRODUCCION']);
    expect(dom38.every((i) => i.cantidad === 1)).toBe(true);
  });
});

describe('construirInventario — top-up de motores cobrados (cantidad Fase 1 → Fase 4)', () => {
  const modeloRol = {
    sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE', mecanismo: '',
    diametro_tubo_mm: 38, codigos_tubo: 'E02;E66', dcto_tubo_cm: 3.8, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
  };
  const vMotor = {
    id: 'm', ubicacion: 'LIVING', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO', modelo: modeloRol,
    panos: [{ ancho: 1.5, alto: 1.8, color: 'BLANCO', motorModelo: 'DOM38' }],
  } as unknown as Ventana;
  const cant = (d: ReturnType<typeof construirInventario>, cod: string) =>
    d.insumos.filter((i) => i.codigo === cod).reduce((s, i) => s + i.cantidad, 0);

  it('3 DOM38 cobrados en una ubicación con 1 paño → DOM38 ×3 y cable ×3 (DOM38 = DOM34)', () => {
    const adic = [{ codInt: 'DOM 38', cantidad: 3, descuento: 0, ubicacion: 'LIVING' }];
    const d = construirInventario([vMotor], {}, undefined, [], false, adic);
    expect(cant(d, 'DOM38')).toBe(3);
    // El motor viene SIN cable: uno por unidad, no uno por paño (regla 2026-07-30).
    expect(cant(d, 'DOM34')).toBe(3);
    // El control sale de lo VENDIDO: sin DOM39 cobrado no hay control.
    expect(cant(d, 'DOM39')).toBe(0);
    // Una sola fila DOM38 (el top-up consolida con el kit del paño).
    expect(d.insumos.filter((i) => i.codigo === 'DOM38')).toHaveLength(1);
  });

  it('5 motores y 2 controles vendidos → 2 controles (no uno por motor)', () => {
    const adic = [
      { codInt: 'DOM 38', cantidad: 5, descuento: 0, ubicacion: 'LIVING' },
      { codInt: 'DOM 39', cantidad: 2, descuento: 0, ubicacion: 'LIVING' },
    ];
    const d = construirInventario([vMotor], {}, undefined, [], false, adic);
    expect(cant(d, 'DOM38')).toBe(5);
    expect(cant(d, 'DOM34')).toBe(5);
    expect(cant(d, 'DOM39')).toBe(2);
  });

  it('sin adicionales de motor: 1 motor por paño (sin regresión)', () => {
    expect(cant(construirInventario([vMotor]), 'DOM38')).toBe(1);
  });

  // OT #3197: se compraron un PANEL SOLAR y un motor DOM 01 y no salían en la
  // hoja. Los adicionales solo entraban si su código estaba en las dos listas
  // cerradas (motores/controles y manillas); el resto se perdía sin aviso.
  describe('cualquier otro adicional que sea MATERIAL también sale', () => {
    const catalogo = {
      'INS 127': { cod: 'ACCESORIO', tipo: 'ACCESORIO', producto: 'PANEL SOLAR', descripcion: 'PANEL + 2 BRAKER + EXTENSOR', precio: 58000, descuento: 0.1 },
      'DOM 01': { cod: 'ACCESORIO', tipo: 'ACCESORIO', producto: 'MOTOR (1 POR ROLLER)', descripcion: 'DOMÓTICA-INALAMBRICO', precio: 170000, descuento: 0.4 },
      INSTDARK: { cod: 'INSTALACION', tipo: 'INSTALACION', producto: 'INSTALACION DARK ROLLER', descripcion: '', precio: 50000, descuento: 0 },
      DARK: { cod: 'ACCESORIO', tipo: 'ACCESORIO', producto: 'SISTEMA DARK ROLLER', descripcion: '', precio: 0, descuento: 0.25 },
      'CENF C': { cod: 'ACCESORIO', tipo: 'ACCESORIO', producto: 'CENEFA CUADRADA', descripcion: '', precio: 40000, descuento: 0.4 },
    } as unknown as Parameters<typeof construirInventario>[1];

    const adic = [
      { codInt: 'INS 127', cantidad: 1, descuento: 0.1, ubicacion: 'ENTRADA' },
      { codInt: 'DOM 01', cantidad: 1, descuento: 0.4, ubicacion: 'ENTRADA' },
      { codInt: 'INSTDARK', cantidad: 1, descuento: 0, ubicacion: 'dorm ppal' },
      { codInt: 'DARK', cantidad: 1, descuento: 0.25, ubicacion: 'PPAL', colorAcc: 'CAFÉ' },
      { codInt: 'CENF C', cantidad: 2.55, descuento: 0.4, ubicacion: 'PPAL', colorAcc: 'CAFÉ' },
    ];

    it('el panel solar y el motor de otro modelo aparecen con su nombre', () => {
      const d = construirInventario([vMotor], catalogo, undefined, [], false, adic);
      expect(cant(d, 'INS127')).toBe(1);
      expect(cant(d, 'DOM01')).toBe(1);
      expect(d.insumos.find((i) => i.codigo === 'INS127')?.descripcion).toBe('[INS127] PANEL SOLAR');
      expect(d.insumos.find((i) => i.codigo === 'DOM01')?.descripcion).toBe('[DOM01] MOTOR (1 POR ROLLER)');
    });

    it('la instalación NO es material de bodega', () => {
      const d = construirInventario([vMotor], catalogo, undefined, [], false, adic);
      expect(cant(d, 'INSTDARK')).toBe(0);
    });

    it('los perfiles y las cenefas tampoco: se cortan, no se retiran de un rack', () => {
      const d = construirInventario([vMotor], catalogo, undefined, [], false, adic);
      expect(cant(d, 'DARK')).toBe(0);
      // Ojo: la `cantidad` de una cenefa es el ANCHO en metros, no una cuenta.
      expect(cant(d, 'CENFC')).toBe(0);
    });

    it('no duplica un código que ya salió por otro camino', () => {
      const conMotor = [
        { codInt: 'DOM 38', cantidad: 3, descuento: 0, ubicacion: 'LIVING' },
        { codInt: 'HER 47', cantidad: 1, descuento: 0, ubicacion: 'LIVING' },
      ];
      const d = construirInventario([vMotor], catalogo, undefined, [], false, conMotor);
      expect(cant(d, 'DOM38')).toBe(3);
      expect(d.insumos.filter((i) => i.codigo === 'DOM38')).toHaveLength(1);
      expect(d.insumos.filter((i) => i.codigo === 'HER47')).toHaveLength(1);
    });

    it('sin catálogo la fila sale igual, rotulada con su código', () => {
      const d = construirInventario([vMotor], {}, undefined, [], false, [
        { codInt: 'INS 127', cantidad: 2, descuento: 0, ubicacion: 'ENTRADA' },
      ]);
      expect(cant(d, 'INS127')).toBe(2);
      expect(d.insumos.find((i) => i.codigo === 'INS127')?.descripcion).toBe('[INS127] INS 127');
    });
  });
});

describe('construirInventario — E78 + cenefa ovalada → tapas (kit ovalada) + pivotes (kit 45) por color', () => {
  // El kit de TAPAS es el ovalada de bodega según color (39 blanco / 38 negro /
  // 12 gris); los PIVOTES salen del kit 45 mm por color (18 blanco / 23 negro);
  // el gris deja los pivotes manuales (sin línea). ROL ovalada = 1 tubo → 2+2;
  // dúo = 2 tubos → 4+4. Solo el tubo E78 gatilla las líneas.
  const modeloRolOv45 = (mec: string) => ({
    sistema: 'CENEFA_OVALADA', tipo_rol: 'ROL_CENEFA_OV_MANUAL_45mm',
    mecanismo: mec, diametro_tubo_mm: 45,
    codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
  });
  const ventRolOv = (ubic: string, color = 'BLANCO', mec = 'MEC_18_OVALADA_BLANCO') =>
    ({
      id: ubic, ubicacion: ubic, producto: 'ROLLER SCREEN PREMIUM', color,
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_45mm', modelo: modeloRolOv45(mec),
      panos: [{ ancho: 2.0, alto: 2.2, color, cenefa: 'Ovalada' }],
    }) as unknown as Ventana;
  const tieneUnidad = (d: ReturnType<typeof construirInventario>, unidad: string) =>
    d.insumos.some((i) => i.unidad === unidad);
  // Las líneas de tapas/pivotes traen la descripción COMPLETA del kit del que
  // salen, no solo "MEC 39" (pedido del usuario 2026-07-15).
  const TAPAS_39 = '[MEC39] OVALADA BLANCO [MEC 39]';
  const TAPAS_38 = '[MEC38] OVALADA NEGRO [MEC 38]';
  const TAPAS_12 = '[MEC12] OVALADA GRIS [MEC 12]';
  const PIV_18 = '[MEC18] 0,45mm BCO [MEC 18]';
  const PIV_23 = '[MEC23] 0,45mm NGR [MEC 23]';

  it('ROL cenefa ovalada BLANCA + E78 → MEC 39 (2 TAPAS) y MEC 18 (2 PIVOTES) en PRODUCCIÓN', () => {
    const d = construirInventario([ventRolOv('LIVING')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === PIV_18)).toMatchObject({
      cantidad: 2, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('E78 + ovalada NO lista el kit de mecanismo completo (se reemplaza por tapas + pivotes)', () => {
    const d = construirInventario([ventRolOv('LIVING')]);
    // El kit completo se emitiría con código MECxx y sin unidad (cantidad 1); con
    // E78 no debe aparecer. La línea de TAPAS sí trae la descripción del kit
    // ("[MEC39] OVALADA…") pero lleva unidad 'TAPAS' — por eso el filtro !unidad.
    expect(d.insumos.find((i) => i.codigo === 'MEC39')).toBeUndefined();
    expect(d.insumos.some((i) => (i.descripcion || '').includes('OVALADA') && !i.unidad)).toBe(false);
    // La línea de tapas SÍ existe, con la descripción completa del kit.
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)?.unidad).toBe('TAPAS');
  });

  it('ROL cenefa ovalada NEGRA + E78 → MEC 38 (TAPAS) y MEC 23 (PIVOTES)', () => {
    const d = construirInventario([ventRolOv('LIVING', 'NEGRO', 'MEC_23_OVALADA_NEGRO')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_38)).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === PIV_23)).toMatchObject({
      cantidad: 2, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('ROL cenefa ovalada GRIS + E78 → MEC 12 (TAPAS) y SIN línea de pivotes (manual)', () => {
    const d = construirInventario([ventRolOv('LIVING', 'GRIS', 'MEC_12_OVALADA_GRIS')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_12)).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });

  it('DÚO manual BLANCO + E78 (sistema CENEFA_OVALADA_DUO, categoría sin "ovalada", cenefa null) → MEC 39 (4 TAPAS) y MEC 18 (4 PIVOTES)', () => {
    // Caso real OT 99990 cortina 7/8: la categoría es DUO_MANUAL_38mm (no dice
    // "ovalada") y el paño no tiene cenefa guardada; la ovalada se detecta por
    // el sistema del modelo. El dúo lleva 2 tubos → 4+4.
    const vDuo = {
      id: 'duo', ubicacion: 'DORMITORIO', producto: 'ROLLER DUO', color: 'BLANCO',
      categoria: 'DUO_MANUAL_38mm',
      modelo: {
        sistema: 'CENEFA_OVALADA_DUO', tipo_rol: 'DUO_CENEFA_OV_MANUAL_45mm',
        mecanismo: 'MEC_18_OVALADA_BLANCO', diametro_tubo_mm: 45,
        codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.5, alto: 2.2, color: 'BLANCO' }], // sin cenefa guardada
    } as unknown as Ventana;
    const d = construirInventario([vDuo]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)).toMatchObject({
      cantidad: 4, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === PIV_18)).toMatchObject({
      cantidad: 4, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
  });

  it('2 cortinas ROL ovalada BLANCA E78 → consolida a 4 TAPAS (MEC 39) y 4 PIVOTES (MEC 18)', () => {
    const d = construirInventario([ventRolOv('LIVING'), ventRolOv('COMEDOR')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)?.cantidad).toBe(4);
    expect(d.insumos.find((i) => i.descripcion === PIV_18)?.cantidad).toBe(4);
  });

  it('mezcla de colores NO se consolida: blanca (MEC 39/18) y negra (MEC 38/23) separadas', () => {
    const d = construirInventario([
      ventRolOv('LIVING'),
      ventRolOv('COMEDOR', 'NEGRO', 'MEC_23_OVALADA_NEGRO'),
    ]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === PIV_18)?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_38)?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.descripcion === PIV_23)?.cantidad).toBe(2);
  });

  it('cenefa ovalada 38 mm (tubo E02, no E78) → NO agrega tapas/pivotes y SÍ lista el mecanismo completo', () => {
    const v = {
      id: 'x', ubicacion: 'PZA', producto: 'ROLLER', color: 'BLANCO',
      categoria: 'ROL_MANUAL_CENEFA_OVALADA_38mm', modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', cenefa: 'Ovalada' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
    // Sin E78 el mecanismo ovalada completo se sigue entregando (solo el E78 lo suprime).
    expect(d.insumos.find((i) => i.codigo === 'MEC39')).toBeDefined();
  });

  // ── Oscuridad (soft light 45/CC) sobre E78: cenefa OVALADA IMPLÍCITA ──
  // El soft light no guarda 'Ovalada' en el paño (la categoría SOFT_LIGHT_* ya lo
  // implica) → antes salía el kit MEC completo; ahora comparte la armadura mixta.
  const modeloSoft45 = (mec = 'MEC_18_OVALADA_BLANCO') => ({
    sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_INTERNO_45mm',
    mecanismo: mec, diametro_tubo_mm: 45,
    codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
  });
  const ventSoft45 = (color = 'BLANCO', mec = 'MEC_18_OVALADA_BLANCO', cenefa?: string) =>
    ({
      id: `s${color}`, ubicacion: 'SOFT', producto: 'ROLLER SCREEN PREMIUM', color,
      categoria: 'SOFT_LIGHT_45mm', modelo: modeloSoft45(mec),
      panos: [{ ancho: 2.5, alto: 2.3, color, ...(cenefa ? { cenefa } : {}) }],
    }) as unknown as Ventana;

  it('SOFT LIGHT 45 BLANCO + E78 (ovalada implícita) → 2 TAPAS (MEC 39) + 2 PIVOTES (MEC 18), sin kit completo', () => {
    const d = construirInventario([ventSoft45('BLANCO')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_39)).toMatchObject({
      cantidad: 2, unidad: 'TAPAS', grupo: 'PRODUCCION',
    });
    expect(d.insumos.find((i) => i.descripcion === PIV_18)).toMatchObject({
      cantidad: 2, unidad: 'PIVOTES', grupo: 'PRODUCCION',
    });
    // El kit ovalada completo ya NO se lista (lo reemplaza la armadura mixta).
    expect(d.insumos.some((i) => (i.descripcion || '').includes('OVALADA') && !i.unidad)).toBe(false);
  });

  it('SOFT LIGHT 45 NEGRO + E78 → MEC 38 (TAPAS) y MEC 23 (PIVOTES)', () => {
    const d = construirInventario([ventSoft45('NEGRO', 'MEC_23_OVALADA_NEGRO')]);
    expect(d.insumos.find((i) => i.descripcion === TAPAS_38)?.unidad).toBe('TAPAS');
    expect(d.insumos.find((i) => i.descripcion === PIV_23)?.unidad).toBe('PIVOTES');
  });

  it('SOFT LIGHT con cenefa CUADRADA (CC) + E78 → también armadura mixta', () => {
    const d = construirInventario([ventSoft45('BLANCO', 'MEC_18_OVALADA_BLANCO', 'Cuadrada a muro')]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(true);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(true);
  });

  // DARK: la excepción. No usa NADA de la armadura de cenefa ovalada — sobre
  // tubería 0,45 lleva el kit COMPLETO MEC 18/23, y va al cuadro de INSTALACIÓN
  // (regla del usuario 2026-07-31).
  const ventDark45 = (color: string) =>
    ({
      id: `d${color}`, ubicacion: 'DARK', producto: 'ROLLER BLACKOUT DARK', color,
      categoria: 'DARK_45mm',
      modelo: {
        sistema: 'DARK_ROLLER', tipo_rol: 'DARK_INTERNO_45mm', mecanismo: '',
        diametro_tubo_mm: 45, codigos_tubo: 'E04; E05; E39; E46; E78',
        dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.5, alto: 2.3, color }],
    }) as unknown as Ventana;

  it('DARK 45 NEGRO + E78 → kit COMPLETO [MEC23] en INSTALACIÓN, sin tapas ni pivotes', () => {
    const d = construirInventario([ventDark45('NEGRO')]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
    expect(d.insumos.find((i) => i.codigo === 'MEC23')).toMatchObject({
      descripcion: '[MEC23] 0,45mm NGR [MEC 23]', cantidad: 1, grupo: 'INSTALACION',
    });
    // Y nada de cenefa ovalada.
    expect(d.insumos.some((i) => (i.descripcion || '').includes('OVALADA'))).toBe(false);
  });

  it('DARK 45 BLANCO + E78 → [MEC18] completo', () => {
    const d = construirInventario([ventDark45('BLANCO')]);
    expect(d.insumos.find((i) => i.codigo === 'MEC18')).toMatchObject({
      descripcion: '[MEC18] 0,45mm BCO [MEC 18]', cantidad: 1, grupo: 'INSTALACION',
    });
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });

  it('SOFT LIGHT 38 mm (tubo E02, sin banda E78) → NO agrega tapas/pivotes', () => {
    const v = {
      id: 's38', ubicacion: 'SOFT', producto: 'ROLLER SCREEN PREMIUM', color: 'BLANCO',
      categoria: 'SOFT_LIGHT_38mm',
      modelo: {
        sistema: 'SOFT_LIGHT', tipo_rol: 'SOFT_LIGHT_INTERNO_38mm',
        mecanismo: 'MEC_18_OVALADA_BLANCO', diametro_tubo_mm: 38,
        codigos_tubo: 'E02; E66', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.0, alto: 2.0, color: 'BLANCO' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });

  it('ROL banda E78 sin cenefa (roller simple 45 mm) → NO agrega las líneas', () => {
    const v = {
      id: 'y', ubicacion: 'PZA', producto: 'ROLLER', color: 'BLANCO',
      categoria: 'ROL',
      modelo: {
        sistema: 'ROLLER_SIMPLE', tipo_rol: 'ROL_SIMPLE',
        mecanismo: 'MEC_18_045_DECORELLI_BLANCO', diametro_tubo_mm: 45,
        codigos_tubo: 'E04; E05; E39; E46; E78', dcto_tubo_cm: 1.8, suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 2.5, alto: 2.2, color: 'BLANCO' }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    expect(tieneUnidad(d, 'TAPAS')).toBe(false);
    expect(tieneUnidad(d, 'PIVOTES')).toBe(false);
  });
});

// Regresión OT 267-3 (jeffi): el PDF mostraba el id del modelo de despiece
// (MEC_05_LZ90_BLANCO / MEC_10_OVALADA_BLANCO) mientras Fase 4 mostraba el kit
// real de bodega (KIT SIMPLE BLANCO 38MM [MEC 33]). Ambos deben coincidir.
describe('construirInventario — mecanismo consistente con Fase 4', () => {
  const vjeffi = (modeloMec: string, categoria: string): Ventana =>
    ({
      id: 'x',
      ubicacion: 'OFICINA IZQ-G1',
      codInt: 'SC 93',
      producto: 'ROLLER SCREEN PREMIUM',
      color: 'BLANCO',
      categoria,
      modelo: {
        sistema: 'ROLLER',
        tipo_rol: 'ROL_SIMPLE',
        mecanismo: modeloMec,
        diametro_tubo_mm: 38,
        codigos_tubo: 'E02',
        dcto_tubo_cm: 1.8,
        suma_peso_cm: 0.1,
      },
      panos: [{ ancho: 1.618, alto: 2.301, colorMecanismo: 'BCO' }],
    }) as unknown as Ventana;

  it('MEC legacy del modelo (MEC_05) + accesorios blancos → KIT [MEC 33], no el id del modelo', () => {
    const data = construirInventario([vjeffi('MEC_05_LZ90_BLANCO', 'ROL')]);
    expect(data.filas[0].codMecanismo).toBe('KIT SIMPLE BLANCO 38MM [MEC 33] BCO');
  });

  it('MEC_10 ovalada legacy resuelve al kit ovalada por color (MEC 39), no al id del modelo', () => {
    const data = construirInventario([
      vjeffi('MEC_10_OVALADA_BLANCO', 'ROL_MANUAL_CENEFA_OVALADA_38mm'),
    ]);
    expect(data.filas[0].codMecanismo).toBe('OVALADA BLANCO [MEC 39] BCO');
  });

  it('accesorios blancos → etiqueta blanca INS 95-1 (misma regla que Fase 4)', () => {
    const data = construirInventario([vjeffi('MEC_05_LZ90_BLANCO', 'ROL')]);
    expect(data.etiquetas).toEqual([{ cod: 'INS 95-1', color: 'BLANCA', cantidad: 1 }]);
  });
});

// Notas de terreno de Fase 2: retiro, material de instalación, cortes,
// suplementos, comentarios… antes se capturaban y no llegaban a NINGÚN
// documento; ahora salen en el bloque NOTAS DE TERRENO del inventario.
describe('notasTerreno', () => {
  it('concatena con rótulos solo los campos con contenido, una fila por paño', () => {
    const v1 = ventana('LIVING', 1.5, 2.0);
    const p = v1.panos![0] as Pano;
    p.retiro = 2;
    p.superficie = 'TECHO';
    p.materialTipo = 'CONCRETO';
    p.cortes = 'Plumavit';
    p.verVideo = true;
    p.relacionMarco = 'Dentro';
    p.cotizarConSin = 'con y sin cenefa';
    p.suplementos = 'alza 5 cm';
    p.comentarioFinal = 'ojo con el enchufe';
    const v2 = ventana('COCINA', 1.0, 1.0); // sin notas → no genera fila

    const notas = notasTerreno([v1, v2]);
    expect(notas).toHaveLength(1);
    expect(notas[0].ubic).toBe('LIVING');
    expect(notas[0].notas).toBe(
      'Retiro: 2 · Material: TECHO / CONCRETO · Cortes: Plumavit · ' +
        'Ver video de terreno · Marco: Dentro · Cotizar con y sin: con y sin cenefa · ' +
        'Suplementos: alza 5 cm · Nota: ojo con el enchufe',
    );
  });

  it("'Nada', 'N/A' y retiro 0 cuentan como sin nota (bloque omitido)", () => {
    const v = ventana('BAÑO', 1, 1);
    const p = v.panos![0] as Pano;
    p.retiro = 0;
    p.cortes = 'Nada';
    p.relacionMarco = 'N/A';
    expect(notasTerreno([v])).toEqual([]);
  });

  it('ventana multi-paño usa la ubicación por paño (-G1/-G2)', () => {
    const v = ventana('PZA 3', 1.2, 1.8);
    v.panos!.push({ ...(v.panos![0] as Pano) });
    (v.panos![1] as Pano).suplementos = 'perfil extra';
    const notas = notasTerreno([v]);
    expect(notas).toHaveLength(1);
    expect(notas[0].ubic).toBe('PZA 3-G2');
    expect(notas[0].notas).toBe('Suplementos: perfil extra');
  });

  it('construirInventario expone las notas para el bloque del PDF', () => {
    const v = ventana('OFICINA', 1.5, 2.4);
    (v.panos![0] as Pano).comentarioFinal = 'cliente pide instalar tarde';
    const d = construirInventario([v]);
    expect(d.notas).toEqual([
      { ubic: 'OFICINA', notas: 'Nota: cliente pide instalar tarde' },
    ]);
  });
});

describe('construirInventario — dual (ROL_DUAL)', () => {
  const modeloDual = {
    sistema: 'ROLLER_DUAL', tipo_rol: 'ROL_DUAL', mecanismo: 'MEC_01_DUAL_DERECHO_BLANCO',
    diametro_tubo_mm: 38, codigos_tubo: 'E01; E02; E66',
    dcto_tubo_cm: 3.9, dcto_tela_cm: 0.5, suma_peso_cm: 0.1,
  };
  const pano = (codInt: string, tipoTela: string): Partial<Pano> => ({
    ancho: 1.6, alto: 1.8, color: 'BLANCO', dual: true, dualLado: 'DERECHO',
    mecanismo: 'DUAL DERECHO BLANCO [MEC 01]', colorMecanismo: 'BCO',
    codCadena: 'CAD03', codPeso: 'PCA04', materialTipo: 'VULCANITA', codInt, tipoTela,
  });
  const vDual = {
    id: 'vd', ubicacion: 'LIVING', producto: 'ROLLER SCREEN', color: 'BLANCO',
    categoria: 'ROL_DUAL', modelo: modeloDual,
    panos: [pano('SC 68', 'SCR'), pano('BK 69', 'BK')],
  } as unknown as Ventana;

  it('UN kit de mecanismo dual (MEC01), 2 cadenas, 2 pesos, tapas ×2/paño, tarugos 1 juego', () => {
    const d = construirInventario([vDual]);
    // 1 kit MEC01 (no ×2 paños).
    const mecs = d.insumos.filter((i) => i.codigo === 'MEC01');
    expect(mecs).toHaveLength(1);
    expect(mecs[0].cantidad).toBe(1);
    // 2 cadenas + 2 pesos.
    expect(d.insumos.find((i) => i.codigo === 'CAD03')?.cantidad).toBe(2);
    expect(d.insumos.find((i) => i.codigo === 'PCA04')?.cantidad).toBe(2);
    // Tapas de peso: 4 (2 por paño). Tarugos: 1 juego (paño 0 → 4).
    const tapas = d.insumos.filter((i) => (i.codigo || '').startsWith('TAP'));
    expect(tapas.reduce((s, t) => s + t.cantidad, 0)).toBe(4);
    const tarugos = d.insumos.filter((i) => (i.codigo || '').startsWith('TAR'));
    expect(tarugos.reduce((s, t) => s + t.cantidad, 0)).toBe(4);
  });
});

// BEEBLACK: kit SML propio, 1 por CORTINA. Todo a PRODUCCIÓN salvo la tapa de
// esquinero; el doble dobla todo menos esquineros y tapas.
describe('construirInventario — BEEBLACK', () => {
  const panoBb = (extra: Partial<Pano> = {}): Partial<Pano> => ({
    ancho: 2, alto: 1.3, color: 'NEGRO', beeblackVariante: 'INTERNO', ...extra,
  });
  const vBb = (panos: Partial<Pano>[], color = 'NEGRO') =>
    ({
      id: 'bb', ubicacion: 'LIVING', codInt: 'BEE-BK', producto: 'BEEBLACK BLACKOUT',
      categoria: 'BEEBLACK', color, alto: 1.3, modelo: null, panos,
    }) as unknown as Ventana;

  it('el kit va a PRODUCCIÓN y solo la tapa de esquinero a INSTALACIÓN', () => {
    const d = construirInventario([vBb([panoBb()])]);
    const porCod = Object.fromEntries(
      d.insumos.filter((i) => (i.codigo || '').startsWith('SML')).map((i) => [i.codigo, i]),
    );
    expect(porCod.SML46).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' });
    expect(porCod.SML17).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    expect(porCod.SML26).toMatchObject({ cantidad: 2, grupo: 'PRODUCCION' });
    expect(porCod.SML32).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    expect(porCod.SML31).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    expect(porCod.SML35).toMatchObject({ cantidad: 4, grupo: 'PRODUCCION' });
    // Tira magnética y felpa: sin número, con el rótulo CALCULAR.
    expect(porCod.SML33).toMatchObject({ cantidad: 0, unidad: 'CALCULAR', grupo: 'PRODUCCION' });
    expect(porCod.SML34).toMatchObject({ cantidad: 0, unidad: 'CALCULAR', grupo: 'PRODUCCION' });
    // Lo único de terreno.
    expect(porCod.SML48).toMatchObject({ cantidad: 4, grupo: 'INSTALACION' });
    const enInstalacion = d.insumos.filter(
      (i) => (i.codigo || '').startsWith('SML') && i.grupo === 'INSTALACION',
    );
    expect(enInstalacion.map((i) => i.codigo)).toEqual(['SML48']);
  });

  it('DOBLE: el kit sale UNA vez con todo ×2, salvo esquineros y sus tapas', () => {
    const d = construirInventario([vBb([panoBb({ dual: true }), panoBb({ dual: true })])]);
    const cant = (cod: string) =>
      d.insumos.filter((i) => i.codigo === cod).reduce((s, i) => s + i.cantidad, 0);
    expect(cant('SML46')).toBe(4);
    expect(cant('SML26')).toBe(4);
    expect(cant('SML32')).toBe(8);
    expect(cant('SML17')).toBe(4); // una sola estructura
    expect(cant('SML48')).toBe(4);
    // Y no se emite dos veces (una por paño).
    expect(d.insumos.filter((i) => i.codigo === 'SML17')).toHaveLength(1);
  });

  it('una cortina que no es beeblack no emite códigos SML', () => {
    const d = construirInventario([ventana('LIVING', 1.5, 2)]);
    expect(d.insumos.some((i) => (i.codigo || '').startsWith('SML'))).toBe(false);
  });
});
