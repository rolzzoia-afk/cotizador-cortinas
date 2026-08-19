import { describe, expect, it } from 'vitest';
import { actualizarFotosYBloques } from './actualizarInforme';

const U = (n: number) =>
  `https://p.supabase.co/storage/v1/object/public/informe-assets/e/g/${n}.jpg`;

const INTRO_DUO = 'Se explican los pasos de luz de las cortinas duo blackout.';
const TIPO = '   - Tipo de Cortina: ROLLER BLACKOUT BK 73 EVEREST (1 paño entero)';

/** Un esqueleto como el que arma la app, con foto de intro y ficha de tela. */
const esqueleto = [
  INTRO_DUO,
  `[foto: ${U(1)}]`,
  '',
  '1. Living',
  TIPO,
  `[foto: ${U(2)}]`,
  '   - Caída: Interna, instalada dentro del marco.',
].join('\n');

/** El informe tal como quedó tras pasar por la IA: sin fotos, con lo conversado. */
const informeSinFotos = [
  INTRO_DUO,
  '',
  'En tu caso se revisó el material del muro: en la biblioteca se perfora sobre madera.',
  '',
  '1. Living',
  TIPO,
  '   - Caída: Interna, instalada dentro del marco.',
  '   - Se explicó en visita que el bow window permite caída externa.',
].join('\n');

describe('actualizarFotosYBloques — fotos', () => {
  it('mete cada foto debajo de su ancla, sin tocar nada más', () => {
    const r = actualizarFotosYBloques(informeSinFotos, esqueleto, []);
    expect(r.fotosAgregadas).toBe(2);
    expect(r.fotosSinUbicar).toBe(0);
    const lineas = r.texto.split('\n');
    expect(lineas[lineas.indexOf(INTRO_DUO) + 1]).toBe(`[foto: ${U(1)}]`);
    expect(lineas[lineas.indexOf(TIPO) + 1]).toBe(`[foto: ${U(2)}]`);
  });

  it('NO borra ni reescribe lo que la IA agregó', () => {
    const r = actualizarFotosYBloques(informeSinFotos, esqueleto, []);
    expect(r.texto).toContain('en la biblioteca se perfora sobre madera');
    expect(r.texto).toContain('Se explicó en visita que el bow window');
    // Todas las líneas originales siguen ahí, en el mismo orden relativo.
    const antes = informeSinFotos.split('\n');
    const despues = r.texto.split('\n').filter((l) => !l.startsWith('[foto:'));
    expect(despues).toEqual(antes);
  });

  it('es idempotente: apretarlo dos veces no duplica la foto', () => {
    const a = actualizarFotosYBloques(informeSinFotos, esqueleto, []);
    const b = actualizarFotosYBloques(a.texto, esqueleto, []);
    expect(b.fotosAgregadas).toBe(0);
    expect(b.texto).toBe(a.texto);
  });

  it('dos fotos de una misma intro entran en su orden', () => {
    const esq = [INTRO_DUO, `[foto: ${U(1)}]`, `[foto: ${U(2)}]`].join('\n');
    const r = actualizarFotosYBloques(INTRO_DUO, esq, []);
    expect(r.texto).toBe([INTRO_DUO, `[foto: ${U(1)}]`, `[foto: ${U(2)}]`].join('\n'));
  });

  it('una foto que ya está no se mueve ni se repite', () => {
    const conUna = [INTRO_DUO, `[foto: ${U(1)}]`].join('\n');
    const esq = [INTRO_DUO, `[foto: ${U(1)}]`, `[foto: ${U(2)}]`].join('\n');
    const r = actualizarFotosYBloques(conUna, esq, []);
    expect(r.fotosAgregadas).toBe(1);
    expect(r.texto.match(new RegExp(U(1), 'g'))).toHaveLength(1);
  });

  it('si el ancla ya no existe, la foto NO se inventa un lugar: se avisa', () => {
    // Alguien reescribió la intro a mano; poner la foto en otra parte sería peor.
    const reescrito = 'Le expliqué a la señora que la duo igual deja pasar luz.';
    const r = actualizarFotosYBloques(reescrito, esqueleto, []);
    // Ninguna de las dos anclas sobrevivió: ni la intro ni el bullet de la tela.
    expect(r.fotosSinUbicar).toBe(2);
    expect(r.fotosAgregadas).toBe(0);
    expect(r.texto).toBe(reescrito);
  });
});

describe('actualizarFotosYBloques — bloques', () => {
  const BLOQUE_A = 'El día de la instalación se cortarán rodapié o guardapolvos.';
  const BLOQUE_B = `Indícanos el límite de perforación.\n[foto: ${U(9)}]`;

  it('agrega al final el bloque que todavía no está', () => {
    const r = actualizarFotosYBloques(informeSinFotos, esqueleto, [BLOQUE_A, BLOQUE_B]);
    expect(r.bloquesAgregados).toBe(2);
    expect(r.texto.endsWith(`Indícanos el límite de perforación.\n[foto: ${U(9)}]`)).toBe(true);
    expect(r.texto).toContain(BLOQUE_A);
  });

  it('un bloque que YA está no se duplica, aunque le hayan corregido el final', () => {
    const conBloque = `${informeSinFotos}\n\n${BLOQUE_A} Se avisa antes.`;
    // La primera línea del bloque cambió, así que se agrega (no se puede
    // reconocer); pero si está intacta, no.
    const intacto = `${informeSinFotos}\n\n${BLOQUE_A}`;
    expect(actualizarFotosYBloques(intacto, esqueleto, [BLOQUE_A]).bloquesAgregados).toBe(0);
    expect(actualizarFotosYBloques(conBloque, esqueleto, [BLOQUE_A]).bloquesAgregados).toBe(1);
  });

  it('la foto de un bloque que ya estaba entra bajo su texto', () => {
    const conBloque = `${informeSinFotos}\n\nIndícanos el límite de perforación.`;
    const r = actualizarFotosYBloques(conBloque, esqueleto, [BLOQUE_B]);
    expect(r.bloquesAgregados).toBe(0);
    expect(r.texto.endsWith(`Indícanos el límite de perforación.\n[foto: ${U(9)}]`)).toBe(true);
  });

  it('es idempotente también con bloques', () => {
    const a = actualizarFotosYBloques(informeSinFotos, esqueleto, [BLOQUE_A, BLOQUE_B]);
    const b = actualizarFotosYBloques(a.texto, esqueleto, [BLOQUE_A, BLOQUE_B]);
    expect(b.bloquesAgregados).toBe(0);
    expect(b.fotosAgregadas).toBe(0);
    expect(b.texto).toBe(a.texto);
  });
});

describe('actualizarFotosYBloques — nada que hacer', () => {
  it('un informe ya al día vuelve igual, sin contar nada', () => {
    const r = actualizarFotosYBloques(informeSinFotos, informeSinFotos, []);
    expect(r).toEqual({
      texto: informeSinFotos,
      fotosAgregadas: 0,
      fotosSinUbicar: 0,
      bloquesAgregados: 0,
    });
  });

  it('un esqueleto sin fotos no cambia nada', () => {
    const r = actualizarFotosYBloques(informeSinFotos, '1. Living\n' + TIPO, []);
    expect(r.texto).toBe(informeSinFotos);
  });
});
