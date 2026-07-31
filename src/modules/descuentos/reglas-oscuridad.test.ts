import { describe, expect, it } from 'vitest';
import {
  aplicarDefaultsPerfiles,
  cortesOscuridad,
  familiaOscuridad,
  familiaOscuridadConDiametro,
  montajeBaseDisponible,
  normalizarVarianteOscuridad,
  type FamiliaOscuridad,
  type MontajeBaseOscuridad,
  type VarianteOscuridad,
} from './reglas-oscuridad';

// Valores DORADOS extraídos celda por celda de SISTEMAS OSCURIDAD.xlsx, con el
// redondeo a 1 decimal de la regla del usuario 2026-07-31: los ajustes en mm
// literales siguen en las tablas, pero cada eslabón de la cadena emite décimas
// (por eso en DARK/OSCURANTI el peso, que era tela + 0,2 mm, coincide con la tela).
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
  // ── SOFT LIGHT 45 MM ── (tubo = cenefa − 3,1; resto igual al 38 salvo el tubo)
  { familia: 'SOFT_LIGHT_45', variante: 'INTERNO', ancho: 200, alto: 200, comp: { Cenefa: 198.8, Tubo: 195.7, 'Tela (ancho)': 192.8, Peso: 193 } },
  { familia: 'SOFT_LIGHT_45', variante: 'SEMI', ancho: 200, alto: 200, comp: { Cenefa: 206.6, Tubo: 203.5, 'Tela (ancho)': 200.6, Peso: 200.8 } },
  { familia: 'SOFT_LIGHT_45', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { Cenefa: 213.2, Tubo: 210.1, 'Tela (ancho)': 207.2, Peso: 207.4 } },
  // ── SOFT LIGHT CON CENEFA CUADRADA (38 y 45) ──
  { familia: 'SOFT_LIGHT_CC', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 199.7, Tubo: 193.9, 'Tela (ancho)': 193.3, Peso: 193.5 } },
  { familia: 'SOFT_LIGHT_CC', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 207.5, Tubo: 201.5, 'Tela (ancho)': 200.9, Peso: 201.1 } },
  { familia: 'SOFT_LIGHT_CC', variante: 'EXTERNO', ancho: 200, alto: 240, comp: { 'Cenefa Delantera': 215.8, Tubo: 209.4, 'Tela (ancho)': 208.8, Peso: 209 } },
  // ── OSCURANTI 0,63 mm ── (pizarra 2026-07-28, mm literal: perfil superior = ancho − 0,03 ·
  // tubo = perfil − 5,8/6/6,4 · tela = tubo − 0,06 · peso = tela + 0,02). Su pieza frontal
  // es el PERFIL SUPERIOR: NO corta cenefa cuadrada delantera (corrección 2026-07-30).
  { familia: 'OSCURANTI', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Perfil superior': 200, Tubo: 194.2, 'Tela (ancho)': 194.1, Peso: 194.1 } },
  { familia: 'OSCURANTI', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Perfil superior': 207.5, Tubo: 201.5, 'Tela (ancho)': 201.4, Peso: 201.5 } },
  { familia: 'OSCURANTI', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { 'Perfil superior': 215.8, Tubo: 209.4, 'Tela (ancho)': 209.3, Peso: 209.4 } },
  // ── DARK ── (pizarra 2026-07-27, mm literal: cenefa del = ancho − 0,03 · trasera = del − 1 ·
  // tubo = trasera − 4,8/5/5,4 · tela = tubo − 0,06 · peso = tela + 0,02 · velcro = del, alto 15)
  { familia: 'DARK', variante: 'INTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 200, 'Cenefa Trasera': 199, 'Ancho Tela Velcro': 200, 'Alto Tela Velcro': 15, Tubo: 194.2, 'Tela (ancho)': 194.1, Peso: 194.1 } },
  { familia: 'DARK', variante: 'SEMI', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 207.5, 'Cenefa Trasera': 206.5, 'Ancho Tela Velcro': 207.5, 'Alto Tela Velcro': 15, Tubo: 201.5, 'Tela (ancho)': 201.4, Peso: 201.5 } },
  { familia: 'DARK', variante: 'EXTERNO', ancho: 200, alto: 200, comp: { 'Cenefa Delantera': 215.8, 'Cenefa Trasera': 214.8, 'Ancho Tela Velcro': 215.8, 'Alto Tela Velcro': 15, Tubo: 209.4, 'Tela (ancho)': 209.3, Peso: 209.4 } },
  // ── DARK 0,45_1,2mm ── (pizarra 2026-07-28): mismo encadenado que el DARK 38.
  { familia: 'DARK_45', variante: 'INTERNO', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 300, 'Cenefa Trasera': 299, 'Ancho Tela Velcro': 300, 'Alto Tela Velcro': 15, Tubo: 294.2, 'Tela (ancho)': 294.1, Peso: 294.1 } },
  { familia: 'DARK_45', variante: 'SEMI', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 307.5, 'Cenefa Trasera': 306.5, Tubo: 301.5, 'Tela (ancho)': 301.4, Peso: 301.5 } },
  { familia: 'DARK_45', variante: 'EXTERNO', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 315.8, 'Cenefa Trasera': 314.8, Tubo: 309.4, 'Tela (ancho)': 309.3, Peso: 309.4 } },
  // ── SOFT LIGHT CENEFA CUADRADA 0,45_1,2mm ── (pizarra 2026-07-28): igual que el
  // DARK 45 pero SIN cenefa trasera ni velcro (tubo = cenefa delantera − 5,8/6/6,4).
  { familia: 'SOFT_LIGHT_CC_45', variante: 'INTERNO', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 300, Tubo: 294.2, 'Tela (ancho)': 294.1, Peso: 294.1 } },
  { familia: 'SOFT_LIGHT_CC_45', variante: 'SEMI', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 307.5, Tubo: 301.5, 'Tela (ancho)': 301.4, Peso: 301.5 } },
  { familia: 'SOFT_LIGHT_CC_45', variante: 'EXTERNO', ancho: 300, alto: 230, comp: { 'Cenefa Delantera': 315.8, Tubo: 309.4, 'Tela (ancho)': 309.3, Peso: 309.4 } },
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

  it('perfil inferior DARK = cenefa frontal − descuento de variante', () => {
    const semi = cortesOscuridad('DARK', 'SEMI', 200, 200, { infPiso: true });
    expect(medida(semi, 'Perfil inferior al Piso')).toBe(201.2); // 207.5 − 6.3
    const interno = cortesOscuridad('DARK', 'INTERNO', 200, 200, { infMuro: true });
    expect(medida(interno, 'Perfil inferior a Muro')).toBe(187.4); // 200 − 12,6
  });

  it('perfil base OSCURANTI = ancho real por variante y montaje (pizarra 2026-07-28)', () => {
    // INTERNO: dentro = ancho − 13,3 (default) · pared a pared = ancho real.
    const intDentro = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true });
    expect(medida(intDentro, 'Perfil inferior a Muro')).toBe(186.7);
    const intPared = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(intPared, 'Perfil inferior a Muro')).toBe(200);
    // SEMI: solo pared a pared = ancho − 7,5 (ignora el montaje "dentro").
    const semi = cortesOscuridad('OSCURANTI', 'SEMI', 200, 200, { infPiso: true });
    expect(medida(semi, 'Perfil inferior al Piso')).toBe(192.5);
    const semiDentro = cortesOscuridad('OSCURANTI', 'SEMI', 200, 200, { infPiso: true, infMontaje: 'DENTRO' });
    expect(medida(semiDentro, 'Perfil inferior al Piso')).toBe(192.5);
    // EXTERNO: dentro = ancho − 0,8 (default) · pared a pared = ancho + 14.
    const extDentro = cortesOscuridad('OSCURANTI', 'EXTERNO', 200, 200, { infMuro: true });
    expect(medida(extDentro, 'Perfil inferior a Muro')).toBe(199.2);
    const extPared = cortesOscuridad('OSCURANTI', 'EXTERNO', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(extPared, 'Perfil inferior a Muro')).toBe(214);
  });

  it('oscuranti lleva PERFIL SUPERIOR y NO cenefa cuadrada delantera', () => {
    const cortes = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, {});
    const perf = cortes.find((c) => c.columnaExcel === 'PERFIL SUPERIOR (CENEF.PRO)');
    expect(perf?.medidaCm).toBe(200);
    expect(perf?.perforacion).toBeUndefined();
    // La cenefa cuadrada E29/E30/E31 es de DARK y soft light CC: en oscuranti se
    // cortaba de más junto al perfil rectangular 50×25 (corrección 2026-07-30).
    expect(cortes.some((c) => c.columnaExcel === 'CENEFA DELANTERA')).toBe(false);
    // Nunca sale por la columna de separadores (esos son E41/E42/E43, opcionales).
    expect(cortes.some((c) => c.columnaExcel === 'SEPARADOR SUPERIOR')).toBe(false);
    // Soft light CC y DARK son al revés: cenefa delantera y ningún perfil superior.
    for (const fam of ['DARK', 'SOFT_LIGHT_CC'] as const) {
      const otros = cortesOscuridad(fam, 'INTERNO', 200, 200, {});
      expect(otros.some((c) => c.columnaExcel === 'PERFIL SUPERIOR (CENEF.PRO)'), fam).toBe(false);
      expect(otros.some((c) => c.columnaExcel === 'CENEFA DELANTERA'), fam).toBe(true);
    }
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
    // "+0,8 mm" literal = 0,08 cm; al redondear a 1 decimal sube a la décima.
    const dentro = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, { infMuro: true });
    expect(medida(dentro, 'Perfil inferior a Muro')).toBe(200.1); // 200 + 0,08 → 200,1
    const dentroBig = cortesOscuridad('SOFT_LIGHT_45', 'EXTERNO', 296.9, 180, { infMuro: true, infMontaje: 'DENTRO' });
    expect(medida(dentroBig, 'Perfil inferior a Muro')).toBe(297); // 296,9 + 0,08 → 297
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

  it('el montaje del base NO afecta a DARK (mide sobre la cenefa)', () => {
    const darkSemi = cortesOscuridad('DARK', 'SEMI', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(darkSemi, 'Perfil inferior a Muro')).toBe(201.2); // 207,5 − 6,3
    const darkInt = cortesOscuridad('DARK', 'INTERNO', 200, 200, { infMuro: true, infMontaje: 'PARED' });
    expect(medida(darkInt, 'Perfil inferior a Muro')).toBe(187.4); // 200 − 12,6
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

describe('aplicarDefaultsPerfiles — perforación base EXTERNA en INTERNO (pizarra 2026-07-27)', () => {
  it('INTERNO: el base nace EXTERNA; los laterales conservan su INTERNA', () => {
    const r = aplicarDefaultsPerfiles({}, 'SOFT_LIGHT_38', 'INTERNO');
    expect(r.infPerf).toBe('EXTERNO');
    expect(r.izqPerf).toBe('INTERNO');
    expect(r.derPerf).toBe('INTERNO');
    expect(r.izqActivo).toBe(true);
    expect(r.derActivo).toBe(true);
  });

  it('OSCURANTI: laterales auto-activados y base EXTERNA en las TRES variantes', () => {
    const interno = aplicarDefaultsPerfiles({}, 'OSCURANTI', 'INTERNO');
    expect(interno.infPerf).toBe('EXTERNO');
    expect(interno.izqActivo).toBe(true);
    expect(interno.derActivo).toBe(true);
    expect(interno.izqPerf).toBe('INTERNO');
    // Pizarra: pared a pared int/ext perforación externa · semi "siempre externa".
    expect(aplicarDefaultsPerfiles({}, 'OSCURANTI', 'SEMI').infPerf).toBe('EXTERNO');
    expect(aplicarDefaultsPerfiles({}, 'OSCURANTI', 'EXTERNO').infPerf).toBe('EXTERNO');
    // Sigue siendo un default editable.
    expect(aplicarDefaultsPerfiles({ infPerf: 'INTERNO' }, 'OSCURANTI', 'SEMI').infPerf).toBe('INTERNO');
  });

  it('EXTERNO / SEMI: el base NO recibe default de perforación (salvo oscuranti)', () => {
    expect(aplicarDefaultsPerfiles({}, 'SOFT_LIGHT_38', 'EXTERNO').infPerf).toBeUndefined();
    expect(aplicarDefaultsPerfiles({}, 'DARK', 'SEMI').infPerf).toBeUndefined();
  });

  it('respeta la perforación del base ya elegida en Fase 2', () => {
    const r = aplicarDefaultsPerfiles({ infPerf: 'INTERNO' }, 'SOFT_LIGHT_38', 'INTERNO');
    expect(r.infPerf).toBe('INTERNO');
  });
});

describe('cortesOscuridad — superficie "dentro del marco" (mide como piso = alto)', () => {
  it('lateral marco = alto real, con nombre propio y sin pendiente', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, { izqMarco: true });
    const izq = c.find((x) => x.columnaExcel === 'PERFIL (IZQ) INT');
    expect(izq?.medidaCm).toBe(200);
    expect(izq?.componente).toBe('Perfil izquierdo dentro del Marco');
    expect(izq?.pendienteMedida).toBeFalsy();
  });

  it('override del marco se respeta', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, { derMarco: true }, { derMarco: 195 });
    expect(medida(c, 'Perfil derecho dentro del Marco')).toBe(195);
  });

  it('inferior marco = medida base normal (ancho − 13,3 en Oscuranti INTERNO)', () => {
    const c = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMarco: true });
    expect(medida(c, 'Perfil inferior dentro del Marco')).toBe(186.7);
  });
});

describe('cortesOscuridad — perfiles separadores (E41/E42/E43)', () => {
  it('el separador comparte la medida del perfil del mismo lado (incl. su override)', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, { izqMuro: true, sepIzq: true });
    expect(medida(c, 'Separador izquierdo')).toBe(210); // = perfil izq a muro (alto + 10)
    const conOverride = cortesOscuridad(
      'SOFT_LIGHT_38', 'INTERNO', 200, 200, { izqMuro: true, sepIzq: true }, { izqMuro: 205 },
    );
    expect(medida(conOverride, 'Separador izquierdo')).toBe(205);
  });

  it('override propio del separador manda sobre la medida del perfil', () => {
    const c = cortesOscuridad(
      'SOFT_LIGHT_38', 'INTERNO', 200, 200, { izqMuro: true, sepIzq: true }, { sepIzq: 188 },
    );
    expect(medida(c, 'Separador izquierdo')).toBe(188);
  });

  it('separador sin medida derivable ni override → pendiente (medida 0)', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, { sepDer: true });
    const sep = c.find((x) => x.columnaExcel === 'SEPARADOR (DER)');
    expect(sep?.pendienteMedida).toBe(true);
    expect(sep?.medidaCm).toBe(0);
  });

  it('OSCURANTI también emite separador (comparte medida del perfil base)', () => {
    const c = cortesOscuridad('OSCURANTI', 'INTERNO', 200, 200, { infMuro: true, sepInf: true });
    expect(medida(c, 'Separador base')).toBe(186.7);
    expect(c.find((x) => x.componente === 'Separador base')?.columnaExcel).toBe('SEPARADOR BASE');
  });

  it('el separador no lleva perforación', () => {
    const c = cortesOscuridad('SOFT_LIGHT_38', 'INTERNO', 200, 200, { izqMuro: true, sepIzq: true });
    expect(c.find((x) => x.componente === 'Separador izquierdo')?.perforacion).toBeUndefined();
  });
});

describe('cortesOscuridad — tubo 45 mm por color de accesorios', () => {
  // Único corte de oscuridad que depende del color: soft light 45 mm negro corta
  // el TUBO en cenefa − 2,9 (blanco = cenefa − 3,1, o sea +0,2 sobre el negro).
  it('45 mm negro: tubo = cenefa − 2,9 (blanco + 0,2); cenefa/tela/peso NO cambian', () => {
    const blanco = { INTERNO: 195.7, SEMI: 203.5, EXTERNO: 210.1 } as const;
    const negro = { INTERNO: 195.9, SEMI: 203.7, EXTERNO: 210.3 } as const;
    for (const variante of ['INTERNO', 'SEMI', 'EXTERNO'] as const) {
      const b = cortesOscuridad('SOFT_LIGHT_45', variante, 200, 200, {}, {}, 'BLANCO');
      const n = cortesOscuridad('SOFT_LIGHT_45', variante, 200, 200, {}, {}, 'NEGRO');
      expect(medida(b, 'Tubo'), `blanco ${variante}`).toBe(blanco[variante]);
      expect(medida(n, 'Tubo'), `negro ${variante}`).toBe(negro[variante]);
      // El resto es idéntico entre colores.
      for (const comp of ['Cenefa', 'Tela (ancho)', 'Peso']) {
        expect(medida(n, comp), `${comp} ${variante}`).toBe(medida(b, comp));
      }
    }
  });

  it('el color NO afecta el tubo del 38 mm (solo el 45 tiene tabla negra)', () => {
    const b = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, {}, {}, 'BLANCO');
    const n = cortesOscuridad('SOFT_LIGHT_38', 'EXTERNO', 200, 200, {}, {}, 'NEGRO');
    expect(medida(b, 'Tubo')).toBe(211.4);
    expect(medida(n, 'Tubo')).toBe(211.4);
  });

  it('gris / vacío / sin color → tabla blanca (default)', () => {
    const gris = cortesOscuridad('SOFT_LIGHT_45', 'EXTERNO', 200, 200, {}, {}, 'GRIS');
    const vacio = cortesOscuridad('SOFT_LIGHT_45', 'EXTERNO', 200, 200, {}, {}, '');
    const sinColor = cortesOscuridad('SOFT_LIGHT_45', 'EXTERNO', 200, 200);
    expect(medida(gris, 'Tubo')).toBe(210.1);
    expect(medida(vacio, 'Tubo')).toBe(210.1);
    expect(medida(sinColor, 'Tubo')).toBe(210.1);
  });
});

describe('montajeBaseDisponible', () => {
  it('soft light INTERNO/EXTERNO ofrecen selector; SEMI no', () => {
    expect(montajeBaseDisponible('SOFT_LIGHT_38', 'INTERNO')).toBe(true);
    expect(montajeBaseDisponible('SOFT_LIGHT_45', 'EXTERNO')).toBe(true);
    expect(montajeBaseDisponible('SOFT_LIGHT_CC', 'SEMI')).toBe(false); // SEMI = pared fija
  });

  it('oscuranti INTERNO/EXTERNO ofrecen selector; SEMI no (solo pared a pared)', () => {
    expect(montajeBaseDisponible('OSCURANTI', 'INTERNO')).toBe(true);
    expect(montajeBaseDisponible('OSCURANTI', 'EXTERNO')).toBe(true);
    expect(montajeBaseDisponible('OSCURANTI', 'SEMI')).toBe(false);
  });

  it('Dark 38 y familia nula nunca ofrecen selector', () => {
    expect(montajeBaseDisponible('DARK', 'EXTERNO')).toBe(false);
    expect(montajeBaseDisponible(null, 'INTERNO')).toBe(false);
  });

  it('0,45_1,2mm (DARK 45 / soft light CC 45): INTERNO y EXTERNO sí, SEMI no', () => {
    expect(montajeBaseDisponible('DARK_45', 'INTERNO')).toBe(true);
    expect(montajeBaseDisponible('DARK_45', 'EXTERNO')).toBe(true);
    expect(montajeBaseDisponible('DARK_45', 'SEMI')).toBe(false);
    expect(montajeBaseDisponible('SOFT_LIGHT_CC_45', 'INTERNO')).toBe(true);
    expect(montajeBaseDisponible('SOFT_LIGHT_CC_45', 'SEMI')).toBe(false);
  });
});

// Pizarras 0,45_1,2mm (2026-07-28): el perfil BASE se mide sobre el ANCHO REAL,
// por variante y montaje (no como el DARK 38, que lo saca de la cenefa).
describe('perfil base 0,45_1,2mm por montaje (DARK 45 / soft light CC 45)', () => {
  const base = (
    familia: FamiliaOscuridad,
    variante: VarianteOscuridad,
    infMontaje?: MontajeBaseOscuridad,
  ) =>
    medida(
      cortesOscuridad(familia, variante, 300, 230, { infPiso: true, infMontaje }),
      'Perfil inferior al Piso',
    );

  for (const familia of ['DARK_45', 'SOFT_LIGHT_CC_45'] as FamiliaOscuridad[]) {
    it(`${familia}: dentro / pared a pared por variante`, () => {
      expect(base(familia, 'INTERNO')).toBe(286.7); // 300 − 13,3
      expect(base(familia, 'INTERNO', 'PARED')).toBe(300); // ancho real
      expect(base(familia, 'SEMI')).toBe(292.5); // solo pared: 300 − 7,5
      expect(base(familia, 'SEMI', 'PARED')).toBe(292.5);
      expect(base(familia, 'EXTERNO')).toBe(299.9); // 300 − 0,8 mm
      expect(base(familia, 'EXTERNO', 'PARED')).toBe(314); // 300 + 14
    });
  }

  it('la perforación del base nace EXTERNA en las tres variantes (editable)', () => {
    for (const variante of ['INTERNO', 'SEMI', 'EXTERNO'] as VarianteOscuridad[]) {
      const eff = aplicarDefaultsPerfiles({}, 'DARK_45', variante);
      expect(eff.infPerf, variante).toBe('EXTERNO');
      // Y los laterales se activan solos, como en el resto de la oscuridad.
      expect(eff.izqActivo).toBe(true);
      expect(eff.derActivo).toBe(true);
    }
  });

  it('regresión: el DARK 38 sigue midiendo el base desde la cenefa', () => {
    // cenefa EXTERNO 215,8 − 12,6 = 203,2 (tabla INF_DESC, sin montaje).
    expect(
      medida(cortesOscuridad('DARK', 'EXTERNO', 200, 200, { infPiso: true }), 'Perfil inferior al Piso'),
    ).toBe(203.2);
  });
});

describe('familiaOscuridad / normalizarVarianteOscuridad', () => {
  it('soft light según cenefa cuadrada', () => {
    expect(familiaOscuridad('SOFT_LIGHT_38mm', 'Ovalada')).toBe('SOFT_LIGHT_38');
    expect(familiaOscuridad('SOFT_LIGHT_38mm', 'Cuadrada')).toBe('SOFT_LIGHT_CC');
    expect(familiaOscuridad('SOFT_LIGHT_45mm', '')).toBe('SOFT_LIGHT_45');
    // El 45 con cenefa cuadrada tiene pizarra propia (0,45_1,2mm).
    expect(familiaOscuridad('SOFT_LIGHT_45mm', 'Cuadrada')).toBe('SOFT_LIGHT_CC_45');
    expect(familiaOscuridad('OSCURANTI_63mm', '')).toBe('OSCURANTI');
    expect(familiaOscuridad('DARK_38mm', '')).toBe('DARK');
    expect(familiaOscuridad('DARK_45mm', '')).toBe('DARK_45');
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

// Regla del usuario 2026-07-31: ninguna medida de corte puede traer más de un
// decimal (el Excel mostraba 219,97 · 214,13 · 201,44…).
describe('redondeo: como máximo 1 decimal', () => {
  const decimales = (n: number) => {
    const s = String(n);
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  };

  it('ningún corte de oscuridad pasa de 1 decimal, en toda familia y variante', () => {
    const familias: FamiliaOscuridad[] = [
      'SOFT_LIGHT_38', 'SOFT_LIGHT_45', 'SOFT_LIGHT_CC', 'SOFT_LIGHT_CC_45',
      'OSCURANTI', 'DARK', 'DARK_45',
    ];
    const variantes: VarianteOscuridad[] = ['INTERNO', 'SEMI', 'EXTERNO'];
    // Anchos con y sin decimal, para que el encadenado arrastre centésimas.
    for (const familia of familias) {
      for (const variante of variantes) {
        for (const ancho of [200, 296.9, 145.7]) {
          const cortes = cortesOscuridad(familia, variante, ancho, 230, {
            izqMuro: true, derPiso: true, infMuro: true, sepIzq: true, sepInf: true,
          });
          for (const c of cortes) {
            expect(decimales(c.medidaCm), `${familia} ${variante} ${ancho} — ${c.componente}=${c.medidaCm}`)
              .toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
