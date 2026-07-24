import { describe, expect, it } from 'vitest';
import { calcularDespiece, contextoDespieceDesdePano, MODELO_DESPIECE_STUB } from './despiece';
import { generarOrdenesOptimizador } from './excel-ordenes';
import type { Ventana } from '@/modules/cotizador/types';

// Valores DORADOS confirmados por el usuario (planilla manual SOFT LIGHT):
//   EXTERNO, ancho 2,50 × alto 2,50, perfiles a piso →
//   cenefa 263,2 · tubo 261,4 · tela 257,2 · peso 257,4 · perfil lateral 250 · alto tela 275.
// Fórmula: ancho +13,2 = cenefa → −1,8 = tubo → −4,2 = tela → +0,2 = peso.

const medida = (cortes: ReturnType<typeof calcularDespiece>['cortes'], comp: string) =>
  cortes.find((c) => c.componente === comp)?.medidaCm;

describe('SOFT LIGHT — flujo de despiece (golden usuario)', () => {
  it('EXTERNO 250×250 con perfiles a piso: cenefa/tubo/tela/peso/perfil/alto tela', () => {
    const ctx = contextoDespieceDesdePano(
      { categoria: 'SOFT_LIGHT_38mm', sentido: 'EXTERNO', alto: 2.5 },
      {
        alto: 2.5,
        cenefa: 'Ovalada',
        oscuridadVariante: 'EXTERNO',
        perfilIzqActivo: true,
        perfilDerActivo: true,
        perfilIzqPiso: true,
        perfilDerPiso: true,
        perfilIzqPerf: 'EXTERNO',
        perfilDerPerf: 'EXTERNO',
      },
    );
    const d = calcularDespiece(MODELO_DESPIECE_STUB, 250, ctx);
    expect(medida(d.cortes, 'Cenefa')).toBe(263.2);
    expect(medida(d.cortes, 'Tubo')).toBe(261.4);
    expect(medida(d.cortes, 'Tela (ancho)')).toBe(257.2);
    expect(medida(d.cortes, 'Peso')).toBe(257.4);
    expect(medida(d.cortes, 'Perfil izquierdo a Piso')).toBe(250);
    expect(medida(d.cortes, 'Perfil derecho a Piso')).toBe(250);
    expect(medida(d.cortes, 'Alto tela')).toBe(275);
    // La cenefa viaja al Excel por la columna CENEFA OVALADA.
    expect(d.cortes.find((c) => c.componente === 'Cenefa')?.columnaExcel).toBe('CENEFA OVALADA');
  });

  it('INTERNO: los laterales se activan solos con perforación INTERNO (default de la variante)', () => {
    // Sin ningún flag de perfil: la variante INTERNO activa ambos laterales.
    const ctx = contextoDespieceDesdePano(
      { categoria: 'SOFT_LIGHT_38mm', sentido: 'INTERNO', alto: 1.8 },
      { alto: 1.8, cenefa: 'Ovalada', oscuridadVariante: 'INTERNO', perfilIzqPiso: true, perfilDerPiso: true },
    );
    const d = calcularDespiece(MODELO_DESPIECE_STUB, 296.9, ctx);
    const izq = d.cortes.find((c) => c.componente.startsWith('Perfil izquierdo'));
    const der = d.cortes.find((c) => c.componente.startsWith('Perfil derecho'));
    expect(izq?.perforacion).toBe('INTERNO');
    expect(der?.perforacion).toBe('INTERNO');
  });
});

describe('SOFT LIGHT — banda E78 (tubo 45 mm)', () => {
  // Modelo soft light con el diámetro como único diferencial (el motor de
  // oscuridad ignora los descuentos del modelo; solo lee el diámetro del tubo).
  const modeloSoft = (diam: 38 | 45) => ({
    ...MODELO_DESPIECE_STUB,
    sistema: 'SOFT_LIGHT',
    tipo_rol: `SOFT_LIGHT_EXTERNO_${diam}mm`,
    diametro_tubo_mm: diam,
  });
  const ctx = () =>
    contextoDespieceDesdePano(
      { categoria: 'SOFT_LIGHT_38mm', sentido: 'EXTERNO', alto: 2.5 },
      { alto: 2.5, cenefa: 'Ovalada', oscuridadVariante: 'EXTERNO', perfilIzqPiso: true, perfilDerPiso: true },
    );

  it('modelo 45 mm: el corte de TUBO usa la fórmula de 45 (cenefa/tela/peso NO cambian)', () => {
    const d38 = calcularDespiece(modeloSoft(38), 250, ctx());
    const d45 = calcularDespiece(modeloSoft(45), 250, ctx());
    expect(medida(d38.cortes, 'Tubo')).toBe(261.4); // 38 mm
    expect(medida(d45.cortes, 'Tubo')).toBe(263.2); // 45 mm (banda E78)
    // El resto es idéntico entre 38 y 45.
    for (const comp of ['Cenefa', 'Tela (ancho)', 'Peso', 'Perfil izquierdo a Piso', 'Alto tela']) {
      expect(medida(d45.cortes, comp)).toBe(medida(d38.cortes, comp));
    }
  });
});

describe('SOFT LIGHT — Excel de órdenes', () => {
  const ventana = (variante: string, perfIzqPiso = true): Ventana =>
    ({
      id: 'v1',
      ubicacion: 'LIVING',
      categoria: 'SOFT_LIGHT_38mm',
      sentido: variante,
      color: 'BLANCO',
      alto: 2.5,
      // El Excel solo despieza si la ventana trae modelo; en oscuridad el modelo
      // se ignora (todo sale de las tablas), así que basta el stub.
      modelo: MODELO_DESPIECE_STUB,
      panos: [
        {
          ancho: 2.5,
          alto: 2.5,
          color: 'BLANCO',
          cenefa: 'Ovalada',
          oscuridadVariante: variante,
          ...(perfIzqPiso ? { perfilIzqPiso: true, perfilDerPiso: true } : {}),
        },
      ],
    }) as unknown as Ventana;

  const col = (aoa: (string | number)[][], nombre: string) => aoa[0].indexOf(nombre);

  it('EXTERNO: CENEFA OVALADA + ALTO TELA + PESO SOFT LIGHT + color/código del peso', () => {
    const { aoa } = generarOrdenesOptimizador('300-1', [ventana('EXTERNO')]);
    expect(aoa[1][col(aoa, 'CENEFA OVALADA')]).toBe(263.2);
    expect(aoa[1][col(aoa, 'ALTO TELA')]).toBe(275);
    expect(aoa[1][col(aoa, 'PESO SOFT LIGHT')]).toBe(257.4);
    // Código/color del peso inferior (E24 blanco).
    expect(String(aoa[1][col(aoa, 'COLOR PESO INF. SOFT LIGHT')])).toContain('E24');
    // Perforación de los laterales (a piso, EXTERNO): TIPO DE PERFORACIÓN (IZQ)/(DER) = EXTERNO.
    expect(aoa[1][col(aoa, 'TIPO DE PERFORACIÓN (IZQ)')]).toBe('EXTERNO');
    expect(aoa[1][col(aoa, 'TIPO DE PERFORACIÓN (DER)')]).toBe('EXTERNO');
    expect(aoa[1][col(aoa, 'PERFIL (IZQ)')]).toBe(250);
  });

  it('SEMI sin superficie: perfiles pendientes → medida vacía + advertencia', () => {
    const { aoa, advertencias } = generarOrdenesOptimizador('300-2', [ventana('SEMI', false)]);
    // Laterales activos (default) pero sin muro/piso ni perforación (SEMI): sin medida.
    expect(aoa[1][col(aoa, 'PERFIL (IZQ)')]).toBe('');
    expect(advertencias.some((a) => a.includes('definir') && a.includes('Fase 2'))).toBe(true);
  });
});
