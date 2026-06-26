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
    expect(f.codMecanismo).toBe('MEC_09_OVALADA_NEGRO');
    expect(f.accionamiento).toBe('[CAD 03] 4mts');
    expect(f.pesoCadena).toBe('[PCA04] TRANSPARENTE'); // color propio del peso, no NEG
    expect(f.ubic).toBe('OFICINA IZQ-G1');
    expect(f.anchoMts).toBe('1,565');
    expect(f.altoMts).toBe('2,476');
  });

  it('consolida mecanismo/cadena/peso con la cantidad de cortinas', () => {
    const descs = data.materiales.map((m) => m.descripcion);
    expect(descs).toContain('MEC_09_OVALADA_NEGRO');
    expect(descs).toContain('[CAD 03] 4mts');
    expect(descs).toContain('[PCA04] TRANSPARENTE');
    for (const m of data.materiales) expect(m.cantidad).toBe(2);
  });

  it('etiquetaCant = nº de cortinas', () => {
    expect(data.etiquetaCant).toBe(2);
  });
});
