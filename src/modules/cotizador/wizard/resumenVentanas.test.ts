import { describe, expect, it } from 'vitest';
import { fichaResumen, gruposResumen, medidaLabel, miniaturaDe } from './resumenVentanas';
import type { Pano, Ventana } from '../types';

const pano = (over: Partial<Pano> = {}): Pano =>
  ({
    ancho: 1.855,
    alto: 2.3,
    color: 'NEGRO',
    colorMecanismo: 'NEGRO',
    superficie: 'TECHO',
    materialTipo: 'CERÁMICA',
    relacionMarco: 'Fuera',
    mecanismo: 'SINFLEX NEGRO [MEC 34]',
    tuberia: '38mm [E02]',
    cenefa: 'Ovalada',
    cenefaTira: 'CON TIRA',
    tipoTela: 'BK',
    cortes: 'PLUMAVIT',
    ...over,
  }) as unknown as Pano;

const vent = (over: Partial<Ventana> = {}, panos: Pano[] = [pano()]): Ventana =>
  ({
    id: 'v1',
    ubicacion: 'LIVING IZQ',
    categoria: 'ROL',
    codInt: 'BK 18',
    producto: 'ROLLER BLACKOUT DELUX',
    descripcion: 'EVEREST',
    tipo: 'DELUX',
    color: 'NEGRO',
    sentido: 'EXTERNO',
    alto: 2.3,
    precio: 0,
    cantidad: 1,
    grupoId: null,
    panos,
    ...over,
  }) as unknown as Ventana;

describe('medidaLabel', () => {
  it('escribe los metros con coma, como se anotan en terreno', () => {
    expect(medidaLabel(1.855)).toBe('1,855');
    expect(medidaLabel(2.3)).toBe('2,3');
    expect(medidaLabel(2)).toBe('2');
  });

  it('sin medida no inventa un cero', () => {
    expect(medidaLabel(0)).toBe('—');
  });
});

describe('miniaturaDe', () => {
  it('trae un ancho por paño y el alto de la cortina', () => {
    const m = miniaturaDe(vent({}, [pano(), pano({ ancho: 1.952 })]));
    expect(m.anchos).toEqual(['1,855', '1,952']);
    expect(m.alto).toBe('2,3');
  });

  it('marca la cortina a la que le falta una medida', () => {
    expect(miniaturaDe(vent()).incompleta).toBe(false);
    expect(miniaturaDe(vent({}, [pano({ ancho: 0 })])).incompleta).toBe(true);
    expect(miniaturaDe(vent({}, [pano(), pano({ alto: 0 })])).incompleta).toBe(true);
  });

  it('una cortina recién creada está incompleta y no muestra medidas falsas', () => {
    const m = miniaturaDe(vent({}, [pano({ ancho: 0, alto: 0 })]));
    expect(m.incompleta).toBe(true);
    expect(m.anchos).toEqual(['—']);
    expect(m.alto).toBe('—');
  });
});

describe('gruposResumen', () => {
  it('agrupa por ubicación respetando el orden de carga', () => {
    const g = gruposResumen([
      vent({ id: 'a', ubicacion: 'LIVING' }),
      vent({ id: 'b', ubicacion: 'DORMITORIO' }),
      vent({ id: 'c', ubicacion: 'LIVING' }),
    ]);
    expect(g.map((x) => x.ubicacion)).toEqual(['LIVING', 'DORMITORIO']);
    expect(g[0].ventanas.map((v) => v.id)).toEqual(['a', 'c']);
  });

  it('sin ventanas devuelve una lista vacía', () => {
    expect(gruposResumen([])).toEqual([]);
  });
});

describe('fichaResumen', () => {
  const filas = (v: Ventana) => Object.fromEntries(fichaResumen(v).map((f) => [f.etiqueta, f.valor]));

  it('muestra los datos de la cortina como se cargaron', () => {
    const f = filas(vent());
    expect(f['Ubicación']).toBe('LIVING IZQ');
    expect(f['Tipo']).toBe('ROLLER BLACKOUT DELUX · BK 18');
    expect(f['Cenefa']).toBe('Ovalada, con tira');
    expect(f['Armado']).toBe('EXTERNO');
    expect(f['Instalación']).toBe('Fuera del marco');
    expect(f['Corte']).toBe('PLUMAVIT');
  });

  it('nombra el modelo especial cuando la ventana va en ángulo', () => {
    expect(filas(vent({ formaVentana: 'bow' }))['Modelo']).toBe('BOW WINDOW');
    expect(filas(vent())['Modelo']).toBeUndefined();
  });

  it('no llena la ficha de guiones: lo que no tiene dato no aparece', () => {
    const f = filas(vent({ sentido: '' }, [pano({ cenefa: 'No', cortes: 'NADA', mecanismo: '' })]));
    expect(f['Cenefa']).toBeUndefined();
    expect(f['Corte']).toBeUndefined();
    expect(f['Armado']).toBeUndefined();
    expect(f['Mecanismo']).toBeUndefined();
    expect(f['Ubicación']).toBe('LIVING IZQ');
  });

  it('el comentario del paño se muestra cuando existe', () => {
    expect(filas(vent({}, [pano({ comentarioFinal: 'ojo con la viga' })]))['Comentario']).toBe(
      'ojo con la viga',
    );
  });
});
