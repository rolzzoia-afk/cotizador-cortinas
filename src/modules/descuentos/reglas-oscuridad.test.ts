import { describe, expect, it } from 'vitest';
import {
  cortesOscuridad,
  familiaOscuridad,
  familiaOscuridadConDiametro,
  montajeBaseDisponible,
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

  it('perfil inferior (no soft-light-INTERNO) = cenefa frontal − descuento de variante', () => {
    const semi = cortesOscuridad('OSCURANTI', 'SEMI', 200, 200, { infPiso: true });
    expect(medida(semi, 'Perfil inferior al Piso')).toBe(201.2); // 207.5 − 6.3
    const oscInterno = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true });
    expect(medida(oscInterno, 'Perfil inferior a Muro')).toBe(186.7); // 199.7 − 13
  });

  it('perfil base SOFT LIGHT INTERNO = ancho − 13,3 (dentro laterales, default)', () => {
    // Antes salía de cenefa frontal − 12,6 (296,9 → 283,1); ahora directo del ancho.
    for (const fam of ['SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC'] as const) {
      const c = cortesOscuridad(fam, 'INTERNO', 296.9, 180, { infMuro: true });
      expect(medida(c, 'Perfil inferior a Muro'), fam).toBe(283.6); // 296,9 − 13,3
    }
  });

  it('perfil base SOFT LIGHT INTERNO pared a pared = ancho real completo', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 296.9, 180, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(c, 'Perfil inferior a Muro')).toBe(296.9);
    // Con 'DENTRO' explícito vuelve a ancho − 13,3.
    const dentro = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 296.9, 180, { infMuro: true, infMontaje: 'DENTRO' });
    expect(medida(dentro, 'Perfil inferior a Muro')).toBe(283.6);
  });

  it('perfil base SOFT LIGHT EXTERNO: dentro = ancho + 0,08 (default) · pared = ancho + 14', () => {
    // "+0,8 mm" literal = 0,08 cm (200 → 200,1 con r1; 296,9 → 297,0).
    const dentro = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, { infMuro: true });
    expect(medida(dentro, 'Perfil inferior a Muro')).toBe(200.1); // 200 + 0,08
    const dentroBig = cortesOscuridad('SOFT_LIGHT_45', 'EXTERNO', 296.9, 180, { infMuro: true, infMontaje: 'DENTRO' });
    expect(medida(dentroBig, 'Perfil inferior a Muro')).toBe(297); // 296,9 + 0,08 → 297,0
    const pared = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(pared, 'Perfil inferior a Muro')).toBe(214); // 200 + 14
  });

  it('perfil base SOFT LIGHT SEMI = ancho + 7,5 SIEMPRE (sin montaje "dentro")', () => {
    const semi = cortesOscuridad('SOFT_LIGHT_38', 'SEMI', 200, 200, { infMuro: true });
    expect(medida(semi, 'Perfil inferior a Muro')).toBe(207.5); // 200 + 7,5
    // Aunque le pasen 'DENTRO', SEMI ignora el montaje (siempre pared a pared).
    const semiDentro = cortesOscuridad('SOFT_LIGHT_45', 'SEMI', 200, 200, { infMuro: true, infMontaje: 'DENTRO' });
    expect(medida(semiDentro, 'Perfil inferior a Muro')).toBe(207.5);
  });

  it('perfil base SOFT LIGHT SEMI: perforación SIEMPRE externa (ignora infPerf)', () => {
    const semi = cortesOscuridad('SOFT_LIGHT_38', 'SEMI', 200, 200, { infMuro: true, infPerf: 'INTERNO' });
    const base = semi.find((c) => c.columnaExcel === 'PERFIL BASE');
    expect(base?.perforacion).toBe('EXTERNO');
    // INTERNO/EXTERNO respetan la perforación elegida (no se fuerza).
    const ext = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, { infMuro: true, infPerf: 'INTERNO' });
    expect(ext.find((c) => c.columnaExcel === 'PERFIL BASE')?.perforacion).toBe('INTERNO');
  });

  it('el montaje del base NO afecta Oscuranti/Dark (no son soft light)', () => {
    const oscPared = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(oscPared, 'Perfil inferior a Muro')).toBe(186.7); // 199,7 − 13, montaje ignorado
    const darkSemi = cortesOscuridad('DARK', 'SEMI', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(darkSemi, 'Perfil inferior a Muro')).toBe(201.2); // 207,5 − 6,3
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

describe('montajeBaseDisponible', () => {
  it('soft light INTERNO/EXTERNO ofrecen selector; SEMI no', () => {
    expect(montajeBaseDisponible('SOFT_LIGHT_38', 'INTERNO')).toBe(true);
    expect(montajeBaseDisponible('SOFT_LIGHT_45', 'EXTERNO')).toBe(true);
    expect(montajeBaseDisponible('SOFT_LIGHT_CC', 'SEMI')).toBe(false); // SEMI = pared fija
  });

  it('Oscuranti/Dark y familia nula nunca ofrecen selector', () => {
    expect(montajeBaseDisponible('OSCURANTI', 'INTERNO')).toBe(false);
    expect(montajeBaseDisponible('DARK', 'EXTERNO')).toBe(false);
    expect(montajeBaseDisponible(null, 'INTERNO')).toBe(false);
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
