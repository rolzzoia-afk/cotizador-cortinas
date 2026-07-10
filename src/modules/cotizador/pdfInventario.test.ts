import { describe, expect, it } from 'vitest';
import { construirInventario, notasTerreno } from './pdfInventario';
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

  it('las cortinas roller emiten tapas de peso por color + tornillos (bloque INSUMOS)', () => {
    // 2 cortinas roller NEG sin cenefa: TAP04+TAP05 (×2 c/u) y TOR02 (2/paño = 4).
    const codes = data.insumos.map((i) => i.codigo);
    expect(codes).toEqual(['TAP04', 'TAP05', 'TOR02']);
    expect(data.insumos.find((i) => i.codigo === 'TOR02')?.cantidad).toBe(4);
    expect(data.insumos.find((i) => i.codigo === 'TAP04')?.cantidad).toBe(2);
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
      { id: 1, descripcion: 'MANILLA CAFÉ', cantidad: 9 },
      { id: 2, descripcion: 'MANILLA NEG', cantidad: 2 },
    ]);
  });

  it('cenefa cuadrada CON_2_TAPAS → línea "TAPA CENEFA CUADRADA {color}" ×2 + brackets', () => {
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
    const tapa = d.insumos.find((i) => i.descripcion === 'TAPA CENEFA CUADRADA NEG');
    expect(tapa?.cantidad).toBe(2);
    // Cenefa cuadrada a techo → BRA04 × cantidadBrackets(1,5) = 3.
    expect(d.insumos.find((i) => i.codigo === 'BRA04')?.cantidad).toBe(3);
  });

  it('motor DOM41 + domótica → kit DOM completo + 1 DOM43 por OT', () => {
    const v = {
      id: 'm', ubicacion: 'DORM', producto: 'ROLLER', categoria: 'ROL', color: 'BLANCO',
      modelo: modeloCenefa,
      panos: [{ ancho: 1.5, alto: 2.0, color: 'BLANCO', motorModelo: 'DOM41', motorDomotica: true }],
    } as unknown as Ventana;
    const d = construirInventario([v]);
    const codes = d.insumos.map((i) => i.codigo);
    expect(codes).toEqual(expect.arrayContaining(['DOM41', 'DOM42', 'DOM40', 'DOM04', 'DOM43']));
    // DOM43 aparece una sola vez.
    expect(d.insumos.filter((i) => i.codigo === 'DOM43')).toHaveLength(1);
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
