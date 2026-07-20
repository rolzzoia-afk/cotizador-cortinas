import { describe, expect, it } from 'vitest';
import { telaDePano } from './telaPano';

describe('telaDePano', () => {
  const v = { codInt: 'SC 68', producto: 'ROLLER SCREEN', descripcion: 'PERLA 5%' };

  it('roller/dúo normal (paño sin tela) → cae a la tela de la ventana', () => {
    expect(telaDePano(v, {})).toEqual({
      codInt: 'SC 68',
      producto: 'ROLLER SCREEN',
      descripcion: 'PERLA 5%',
    });
  });

  it('dual (paño con su tela) → usa la del paño', () => {
    const p = { codInt: 'BK 69', producto: 'ROLLER BLACKOUT', descripcion: 'NEGRO' };
    expect(telaDePano(v, p)).toEqual({
      codInt: 'BK 69',
      producto: 'ROLLER BLACKOUT',
      descripcion: 'NEGRO',
    });
  });

  it('fallback campo a campo (paño con codInt pero sin descripción)', () => {
    expect(telaDePano(v, { codInt: 'BK 69', producto: 'ROLLER BLACKOUT' })).toEqual({
      codInt: 'BK 69',
      producto: 'ROLLER BLACKOUT',
      descripcion: 'PERLA 5%',
    });
  });

  it('ventana y paño vacíos → strings vacíos', () => {
    expect(telaDePano({}, {})).toEqual({ codInt: '', producto: '', descripcion: '' });
  });
});
