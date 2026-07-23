import { describe, expect, it } from 'vitest';
import {
  cortesOscuridad,
  familiaOscuridad,
  familiaOscuridadConDiametro,
  normalizarVarianteOscuridad,
  type FamiliaOscuridad,
  type VarianteOscuridad,
} from './reglas-oscuridad';

// Valores DORADOS extraídos celda por celda de SISTEMAS OSCURIDAD.xlsx.
// Cada bloque: [familia, variante, ancho, alto, { componente: totalCm }].
type Caso = {
  familia: FamiliaOscuridad;
  variante: VarianteOscuridad;
  ancho: number;
  alto: number;
  comp: Record<string, number>;
};

const CASOS: Caso[] = [
  // ── SOFT LIGHT 38 MM ──
  { familia: 'SOFT_LIGHT_38', variante: 'INTERNO', ancho: 296.9, alto: 180, comp: { Cenefa: 295.7, Tubo: 293.9, 'Tela (ancho)': 289.7, Peso: 289.9 } },
  { familia: 'SOFT_LIGHT_38', variante: 'SEMI', ancho: 200, alto: 200, comp: { Cenefa: 206.6, Tubo: 204.8, 'Tela (ancho)': 200.6, Peso: 200.8 } },
  { familia: 'SOFT_LIGHT_38', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { Cenefa: 213.2, Tubo: 211.4, 'Tela (ancho)': 207.2, Peso: 207.4 } },
  // ── SOFT LIGHT 45 MM ──
  { familia: 'SOFT_LIGHT_45', variante: 'INTERNO', ancho: 200, alto: 200, comp: { Cenefa: 198.8, Tubo: 198.8, 'Tela (ancho)': 192.8, Peso: 193 } },
  { familia: 'SOFT_LIGHT_45', variante: 'SEMI', ancho: 200, alto: 200, comp: { Cenefa: 206.6, Tubo: 206.6, 'Tela (ancho)': 200.6, Peso: 200.8 } },
  { familia: 'SOFT_LIGHT_45', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { Cenefa: 213.2, Tubo: 213.2, 'Tela (ancho)': 207.2, Peso: 207.4 } },
  // ── SOFT LIGHT CON CENEFA CUADRADA (38 y 45) ──
  { familia: 'SOFT_LIGHT_CC', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 199.7, Tubo: 193.9, 'Tela (ancho)': 193.3, Peso: 193.5 } },
  { familia: 'SOFT_LIGHT_CC', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 207.5, Tubo: 201.5, 'Tela (ancho)': 200.9, Peso: 201.1 } },
  { familia: 'SOFT_LIGHT_CC', variante: 'EXTERNO', ancho: 200, alto: 240, comp: { 'Cenefa Delantera': 215.8, Tubo: 209.4, 'Tela (ancho)': 208.8, Peso: 209 } },
  // ── OSCURANTI ──
  { familia: 'OSCURANTI', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 199.7, Tubo: 193.9, 'Tela (ancho)': 193.3, Peso: 193.5 } },
  { familia: 'OSCURANTI', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 207.5, Tubo: 201.5, 'Tela (ancho)': 200.9, Peso: 201.1 } },
  { familia: 'OSCURANTI', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 215.8, Tubo: 209.4, 'Tela (ancho)': 208.8, Peso: 209 } },
  // ── DARK ──
  { familia: 'DARK', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 199.7, 'Cenefa Trasera': 198.7, 'Ancho Tela Velcro': 199.7, 'Alto Tela Velcro': 15, Tubo: 193.9, 'Tela (ancho)': 193.3, Peso: 193.5 } },
  { familia: 'DARK', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 207.5, 'Cenefa Trasera': 206.5, 'Ancho Tela Velcro': 207.5, 'Alto Tela Velcro': 15, Tubo: 201.5, 'Tela (ancho)': 200.9, Peso: 201.1 } },
  { familia: 'DARK', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 215.8, 'Cenefa Trasera': 214.8, 'Ancho Tela Velcro': 215.8, 'Alto Tela Velcro': 15, Tubo: 209.4, 'Tela (ancho)': 208.8, Peso: 209 } },
];

const medida = (cortes: ReturnType<typeof cortesOscuridad>, nombre: string) =>
  cortes.find((c) => c.componente === nombre)?.medidaCm;

describe('cortesOscuridad — componentes (golden Excel)', () => {
  for (const caso of CASOS) {
    it(`${caso.familia} ${caso.variante} (a=${caso.ancho}, h=${caso.alto})`, () => {
      const cortes = cortesOscuridad(caso.familia, caso.variante, caso.ancho, caso.alto);
      for (const [nombre, total] of Object.entries(caso.comp)) {
        expect(medida(cortes, nombre), nombre).toBe(total);
      }
    });
  }
});

describe('cortesOscuridad — perfiles ON/OFF', () => {
  it('lateral a muro = alto + 10; a piso = alto (colapsa, muro gana)', () => {
    const cortes = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, {
      izqMuro: true,
      izqPiso: true, // ignorado: muro tiene prioridad
      derPiso: true,
    });
    expect(medida(cortes, 'Perfil izquierdo a Muro')).toBe(210);
    expect(medida(cortes, 'Perfil derecho a Piso')).toBe(200);
    // un solo corte por lado
    expect(cortes.filter((c) => c.columnaExcel === 'PERFIL (IZQ) INT')).toHaveLength(1);
  });

  it('perfil inferior = cenefa frontal − descuento de variante', () => {
    const soft38 = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 296.9, 180, { infMuro: true });
    expect(medida(soft38, 'Perfil inferior a Muro')).toBe(283.1); // 295.7 − 12.6
    const semi = cortesOscuridad('OSCURANTI', 'SEMI', 200, 200, { infPiso: true });
    expect(medida(semi, 'Perfil inferior al Piso')).toBe(201.2); // 207.5 − 6.3
    const oscInterno = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true });
    expect(medida(oscInterno, 'Perfil inferior a Muro')).toBe(186.7); // 199.7 − 13
  });

  it('sin perfiles ON no agrega cortes de perfil', () => {
    const cortes = cortesOscuridad('DARK', 'EXTERNO', 200, 200, {});
    expect(cortes.some((c) => c.perfil)).toBe(false);
  });

  it('medida manual sobreescribe la calculada (ajuste de terreno)', () => {
    const cortes = cortesOscuridad(
      'OSCURANTI',
      'INTERNO',
      200,
      200,
      { izqMuro: true, infMuro: true },
      { izqMuro: 189 }, // vendedor le quita 1 cm a los 190
    );
    expect(medida(cortes, 'Perfil izquierdo a Muro')).toBe(189);
    // sin override usa la calculada (OSCURANTI interno: 199.7 − 13)
    expect(medida(cortes, 'Perfil inferior a Muro')).toBe(186.7);
  });

  it('override inválido (0 o negativo) cae a la medida calculada', () => {
    const cortes = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { izqMuro: true }, { izqMuro: 0 });
    expect(medida(cortes, 'Perfil izquierdo a Muro')).toBe(210);
  });
});

describe('familiaOscuridad / normalizarVarianteOscuridad', () => {
  it('soft light según cenefa cuadrada', () => {
    expect(familiaOscuridad('SOFT_LIGHT_38mm', 'Ovalada')).toBe('SOFT_LIGHT_38');
    expect(familiaOscuridad('SOFT_LIGHT_38mm', 'Cuadrada')).toBe('SOFT_LIGHT_CC');
    expect(familiaOscuridad('SOFT_LIGHT_45mm', '')).toBe('SOFT_LIGHT_45');
    expect(familiaOscuridad('SOFT_LIGHT_45mm', 'Cuadrada')).toBe('SOFT_LIGHT_CC');
    expect(familiaOscuridad('OSCURANTI_63mm', '')).toBe('OSCURANTI');
    expect(familiaOscuridad('DARK_38mm', '')).toBe('DARK');
    expect(familiaOscuridad('ROL', '')).toBeNull();
  });

  it('familiaOscuridadConDiametro: soft light 38 mm sobre tubo 45 mm (banda E78) → SOFT_LIGHT_45', () => {
    // Solo el soft light 38 mm NO cuadrado se sube a 45; el resto no se toca.
    expect(familiaOscuridadConDiametro('SOFT_LIGHT_38mm', 'Ovalada', 45)).toBe('SOFT_LIGHT_45');
    expect(familiaOscuridadConDiametro('SOFT_LIGHT_38mm', 'Ovalada', 38)).toBe('SOFT_LIGHT_38');
    expect(familiaOscuridadConDiametro('SOFT_LIGHT_38mm', 'Ovalada', undefined)).toBe('SOFT_LIGHT_38');
    // Cuadrada (CC) no se toca: 38 y 45 son idénticas en corte.
    expect(familiaOscuridadConDiametro('SOFT_LIGHT_38mm', 'Cuadrada', 45)).toBe('SOFT_LIGHT_CC');
    // 45 nativo y DARK quedan igual.
    expect(familiaOscuridadConDiametro('SOFT_LIGHT_45mm', 'Ovalada', 38)).toBe('SOFT_LIGHT_45');
    expect(familiaOscuridadConDiametro('DARK_38mm', '', 45)).toBe('DARK');
  });

  it('normaliza variante desde sentido / selección', () => {
    expect(normalizarVarianteOscuridad('Interno')).toBe('INTERNO');
    expect(normalizarVarianteOscuridad('semi')).toBe('SEMI');
    expect(normalizarVarianteOscuridad('EXTERNO')).toBe('EXTERNO');
    expect(normalizarVarianteOscuridad('')).toBe('INTERNO');
  });
});
