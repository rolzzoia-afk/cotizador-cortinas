import { describe, it, expect } from 'vitest';
import {
  conDctManual,
  dctManualDeTramo,
  dctManualFromPersist,
  dctManualParaMotor,
  sinDctManual,
} from './instalacionManual';

const CODIGOS = ['INST', 'INST-BB'];

describe('el % de instalación escrito a mano, tramo por tramo', () => {
  it('sin nada escrito, cada tramo manda a la regla automática', () => {
    expect(dctManualDeTramo(null, 'INST')).toBeNull();
    expect(dctManualParaMotor(null)).toBeNull();
  });

  it('un número suelto (cotización vieja) vale para TODOS los tramos', () => {
    expect(dctManualDeTramo(50, 'INST')).toBe(50);
    expect(dctManualDeTramo(50, 'INST-BB')).toBe(50);
    expect(dctManualDeTramo(50, 'INST-LO-QUE-SEA')).toBe(50);
    // Y se le manda al motor tal cual: sigue siendo uno solo.
    expect(dctManualParaMotor(50)).toBe(0.5);
  });

  it('escribir en una fila abre el valor por tramo y conserva lo que mostraban las otras', () => {
    const s = conDctManual(50, 'INST', 100, CODIGOS);
    expect(s).toEqual({ INST: 100, 'INST-BB': 50 });
    expect(dctManualParaMotor(s)).toEqual({ INST: 1, 'INST-BB': 0.5 });
  });

  it('la roller gratis y el beeblack entero es lo que se pidió', () => {
    const s = conDctManual(conDctManual(null, 'INST', 100, CODIGOS), 'INST-BB', 0, CODIGOS);
    expect(s).toEqual({ INST: 100, 'INST-BB': 0 });
  });

  it('el % se acota entre 0 y 100, venga como venga', () => {
    expect(conDctManual(null, 'INST', 250, CODIGOS)).toEqual({ INST: 100 });
    expect(conDctManual(null, 'INST', -20, CODIGOS)).toEqual({ INST: 0 });
    expect(dctManualDeTramo(500, 'INST')).toBe(100);
  });

  it('«auto» devuelve ese tramo a la regla; sin ninguno a mano vuelve a null', () => {
    const dos = { INST: 100, 'INST-BB': 0 };
    expect(sinDctManual(dos, 'INST', CODIGOS)).toEqual({ 'INST-BB': 0 });
    expect(sinDctManual({ INST: 100 }, 'INST', CODIGOS)).toBeNull();
    // «Auto» sobre un número suelto deja a los demás con lo que mostraban.
    expect(sinDctManual(30, 'INST', CODIGOS)).toEqual({ 'INST-BB': 30 });
  });

  it('los códigos no distinguen mayúsculas ni espacios', () => {
    expect(dctManualDeTramo({ 'inst-bb': 40 }, 'INST-BB')).toBe(40);
    expect(conDctManual(null, ' inst ', 10, CODIGOS)).toEqual({ INST: 10 });
  });

  it('lo guardado en la OT vuelve como %, y la basura no rompe nada', () => {
    expect(dctManualFromPersist(0.5)).toBe(50);
    expect(dctManualFromPersist({ INST: 1, 'INST-BB': 0 })).toEqual({ INST: 100, 'INST-BB': 0 });
    expect(dctManualFromPersist(undefined)).toBeNull();
    expect(dctManualFromPersist(null)).toBeNull();
    expect(dctManualFromPersist('50%')).toBeNull();
    expect(dctManualFromPersist([1, 2])).toBeNull();
    expect(dctManualFromPersist({ INST: 'mucho' })).toBeNull();
    expect(dctManualFromPersist({})).toBeNull();
  });

  it('un objeto vacío no se guarda: eso es «sin nada a mano»', () => {
    expect(dctManualParaMotor({})).toBeNull();
  });
});
