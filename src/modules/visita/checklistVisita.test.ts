import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_VISITA_DEFAULT,
  idDePregunta,
  moverPregunta,
  normalizarChecklistVisita,
  pendientesChecklist,
  preguntasActivas,
  type ChecklistVisita,
} from './checklistVisita';

describe('checklist de fábrica', () => {
  it('trae las seis preguntas del formulario de terreno, en orden y activas', () => {
    const p = CHECKLIST_VISITA_DEFAULT.preguntas;
    expect(p).toHaveLength(6);
    expect(p.map((x) => x.orden)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p.every((x) => x.activa)).toBe(true);
    expect(p[0].id).toBe('tiempo-instalacion');
    expect(p[5].id).toBe('resumen-orden');
  });

  it('cada pregunta tiene id, título y texto', () => {
    for (const x of CHECKLIST_VISITA_DEFAULT.preguntas) {
      expect(x.id).toMatch(/^[a-z0-9-]+$/);
      expect(x.titulo.length).toBeGreaterThan(0);
      expect(x.pregunta.length).toBeGreaterThan(10);
    }
  });
});

describe('idDePregunta', () => {
  it('convierte el título en una llave estable', () => {
    expect(idDePregunta('Tiempo de instalación')).toBe('tiempo-de-instalacion');
    expect(idDePregunta('  Techos y MUROS  ')).toBe('techos-y-muros');
    expect(idDePregunta('¿Pasos de luz?')).toBe('pasos-de-luz');
  });

  it('un título sin letras da cadena vacía en vez de basura', () => {
    expect(idDePregunta('¿¿??')).toBe('');
    expect(idDePregunta('')).toBe('');
  });
});

describe('normalizarChecklistVisita', () => {
  it('lo guardado corrupto cae al checklist de fábrica', () => {
    expect(normalizarChecklistVisita(null)).toBe(CHECKLIST_VISITA_DEFAULT);
    expect(normalizarChecklistVisita('basura')).toBe(CHECKLIST_VISITA_DEFAULT);
    expect(normalizarChecklistVisita({ preguntas: [] })).toBe(CHECKLIST_VISITA_DEFAULT);
    expect(normalizarChecklistVisita({ preguntas: [{}] })).toBe(CHECKLIST_VISITA_DEFAULT);
  });

  it('acepta también un array suelto (formato viejo)', () => {
    const out = normalizarChecklistVisita([
      { id: 'a', titulo: 'A', pregunta: '¿A?', orden: 1, activa: true },
    ]);
    expect(out.preguntas).toHaveLength(1);
  });

  it('completa el id desde el título cuando falta', () => {
    const out = normalizarChecklistVisita({
      preguntas: [{ titulo: 'Techos y muros', pregunta: '¿Se revisó?' }],
    });
    expect(out.preguntas[0].id).toBe('techos-y-muros');
  });

  it('dos preguntas con el mismo id NO se pisan: la segunda recibe sufijo', () => {
    // Si se pisaran, las dos compartirían respuesta en la OT.
    const out = normalizarChecklistVisita({
      preguntas: [
        { id: 'x', titulo: 'Uno', pregunta: '¿1?' },
        { id: 'x', titulo: 'Dos', pregunta: '¿2?' },
      ],
    });
    expect(out.preguntas.map((p) => p.id)).toEqual(['x', 'x-2']);
  });

  it('renumera el orden y respeta el que traía', () => {
    const out = normalizarChecklistVisita({
      preguntas: [
        { id: 'b', titulo: 'B', pregunta: '¿b?', orden: 9 },
        { id: 'a', titulo: 'A', pregunta: '¿a?', orden: 2 },
      ],
    });
    expect(out.preguntas.map((p) => p.id)).toEqual(['a', 'b']);
    expect(out.preguntas.map((p) => p.orden)).toEqual([1, 2]);
  });

  it('`activa` solo se apaga con un false explícito', () => {
    const out = normalizarChecklistVisita({
      preguntas: [
        { id: 'a', titulo: 'A', pregunta: '¿a?' },
        { id: 'b', titulo: 'B', pregunta: '¿b?', activa: false },
      ],
    });
    expect(out.preguntas.map((p) => p.activa)).toEqual([true, false]);
  });
});

describe('preguntasActivas', () => {
  it('deja fuera las apagadas y respeta el orden', () => {
    const c: ChecklistVisita = {
      preguntas: [
        { id: 'c', titulo: 'C', pregunta: '?', orden: 3, activa: true },
        { id: 'a', titulo: 'A', pregunta: '?', orden: 1, activa: true },
        { id: 'b', titulo: 'B', pregunta: '?', orden: 2, activa: false },
      ],
    };
    expect(preguntasActivas(c).map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('moverPregunta', () => {
  const c: ChecklistVisita = {
    preguntas: [
      { id: 'a', titulo: 'A', pregunta: '?', orden: 1, activa: true },
      { id: 'b', titulo: 'B', pregunta: '?', orden: 2, activa: true },
      { id: 'c', titulo: 'C', pregunta: '?', orden: 3, activa: true },
    ],
  };

  it('sube y baja renumerando', () => {
    expect(moverPregunta(c, 'b', -1).preguntas.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(moverPregunta(c, 'b', 1).preguntas.map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(moverPregunta(c, 'b', -1).preguntas.map((p) => p.orden)).toEqual([1, 2, 3]);
  });

  it('en los extremos no hace nada', () => {
    expect(moverPregunta(c, 'a', -1)).toBe(c);
    expect(moverPregunta(c, 'c', 1)).toBe(c);
    expect(moverPregunta(c, 'no-existe', 1)).toBe(c);
  });
});

describe('pendientesChecklist', () => {
  it('cuenta solo las activas sin responder', () => {
    const c = CHECKLIST_VISITA_DEFAULT;
    expect(pendientesChecklist(c, undefined)).toBe(6);
    expect(pendientesChecklist(c, { 'tiempo-instalacion': { respuesta: true } })).toBe(5);
    // Un NO también cuenta como respondida: lo que falta es no haber contestado.
    expect(pendientesChecklist(c, { 'tiempo-instalacion': { respuesta: false } })).toBe(5);
    expect(pendientesChecklist(c, { 'tiempo-instalacion': { respuesta: null } })).toBe(6);
  });

  it('una respuesta huérfana (pregunta borrada en Admin) no descuenta', () => {
    expect(pendientesChecklist(CHECKLIST_VISITA_DEFAULT, { 'ya-no-existe': { respuesta: true } }))
      .toBe(6);
  });
});
