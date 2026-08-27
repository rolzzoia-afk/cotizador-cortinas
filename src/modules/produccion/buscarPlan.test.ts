import { describe, expect, it } from 'vitest';
import { elegirPlanDeOT, normalizarNumeroOT, planCubreOT } from './buscarPlan';

describe('normalizarNumeroOT', () => {
  it('saca el gato y los espacios que puso el optimizador', () => {
    expect(normalizarNumeroOT('#3197')).toBe('3197');
    expect(normalizarNumeroOT('  3197 ')).toBe('3197');
    expect(normalizarNumeroOT('OT 3182')).toBe('3182');
  });

  it('el grupo -G# es una división interna, no otra OT', () => {
    expect(normalizarNumeroOT('3006-G1')).toBe('3006');
    expect(normalizarNumeroOT('#3120-G1')).toBe('3120');
  });

  it('los sufijos de verdad se respetan: -B y -1 son OTs distintas', () => {
    expect(normalizarNumeroOT('3187-B')).toBe('3187-B');
    expect(normalizarNumeroOT('3205-1')).toBe('3205-1');
    expect(normalizarNumeroOT('2964-C')).toBe('2964-C');
  });

  it('vacío o basura queda vacío', () => {
    expect(normalizarNumeroOT('')).toBe('');
    expect(normalizarNumeroOT(null)).toBe('');
    expect(normalizarNumeroOT(undefined)).toBe('');
  });
});

describe('elegirPlanDeOT', () => {
  const planes = [
    { id: 'nuevo', ots: ['#3197'] },
    { id: 'viejo', ots: ['3187-B'] },
    { id: 'sucio', ots: ['3054- SERV', '3061- SERV'] },
    { id: 'grupo', ots: ['3006-G1'] },
  ];

  it('calza aunque el plan traiga gato y la OT no', () => {
    expect(elegirPlanDeOT(planes, '3197')?.id).toBe('nuevo');
  });

  it('respeta el orden recibido: el primero gana', () => {
    const dos = [
      { id: 'reciente', ots: ['3197'] },
      { id: 'antiguo', ots: ['#3197'] },
    ];
    expect(elegirPlanDeOT(dos, '3197')?.id).toBe('reciente');
  });

  it('la OT con sufijo -B encuentra SU plan, no el de la 3187 pelada', () => {
    expect(elegirPlanDeOT(planes, '3187-B')?.id).toBe('viejo');
  });

  it('el grupo -G1 lo encuentra la OT pelada', () => {
    expect(elegirPlanDeOT(planes, '3006')?.id).toBe('grupo');
  });

  it('rescata la celda escrita a mano cuando no hay calce exacto', () => {
    expect(elegirPlanDeOT(planes, '3054')?.id).toBe('sucio');
    expect(elegirPlanDeOT(planes, '3061')?.id).toBe('sucio');
  });

  it('sin nada parecido devuelve null', () => {
    expect(elegirPlanDeOT(planes, '9999')).toBe(null);
    expect(elegirPlanDeOT(planes, '')).toBe(null);
    expect(elegirPlanDeOT([], '3197')).toBe(null);
  });

  it('una OT que no es número tampoco revienta', () => {
    expect(elegirPlanDeOT(planes, 'SIMULADOR - DANIEL')).toBe(null);
  });
});

describe('planCubreOT', () => {
  it('solo dice que sí con calce exacto, sin la aproximación', () => {
    expect(planCubreOT({ ots: ['#3197'] }, '3197')).toBe(true);
    expect(planCubreOT({ ots: ['3054- SERV'] }, '3054')).toBe(false);
    expect(planCubreOT({ ots: ['3197'] }, '')).toBe(false);
  });
});
