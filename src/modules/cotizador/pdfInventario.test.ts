import { describe, expect, it } from 'vitest';
import { construirInventario } from './pdfInventario';
import type { Ventana } from '@/modules/cotizador/types';

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
    expect(f.accionamiento).toBe('[CAD 03] 4mts');
    expect(f.pesoCadena).toBe('[PCA04] TRANSPARENTE'); // color propio del peso, no NEG
    expect(f.ubic).toBe('OFICINA IZQ-G1');
    expect(f.anchoMts).toBe('1,565');
    expect(f.altoMts).toBe('2,476');
  });

  it('consolida mecanismo/cadena/peso con la cantidad de cortinas', () => {
    const descs = data.materiales.map((m) => m.descripcion);
    expect(descs).toContain('KIT SIMPLE NEGRO 38MM [MEC 32]');
    expect(descs).toContain('[CAD 03] 4mts');
    expect(descs).toContain('[PCA04] TRANSPARENTE');
    for (const m of data.materiales) expect(m.cantidad).toBe(2);
  });

  it('etiquetas: 1 por cortina, código según color de accesorios (NEG → INS 95 negra)', () => {
    expect(data.etiquetas).toEqual([{ cod: 'INS 95', color: 'NEGRA', cantidad: 2 }]);
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

  it('MEC_10 ovalada legacy también resuelve al kit por color', () => {
    const data = construirInventario([
      vjeffi('MEC_10_OVALADA_BLANCO', 'ROL_MANUAL_CENEFA_OVALADA_38mm'),
    ]);
    expect(data.filas[0].codMecanismo).toBe('KIT SIMPLE BLANCO 38MM [MEC 33] BCO');
  });

  it('accesorios blancos → etiqueta blanca INS 95-1 (misma regla que Fase 4)', () => {
    const data = construirInventario([vjeffi('MEC_05_LZ90_BLANCO', 'ROL')]);
    expect(data.etiquetas).toEqual([{ cod: 'INS 95-1', color: 'BLANCA', cantidad: 1 }]);
  });
});
