import { describe, expect, it } from 'vitest';
import { esqueletoInforme, familiaTexto, tieneOscuridad } from './esqueletoInforme';
import type { Pano, Ventana } from '@/modules/cotizador/types';

const pano = (extra: Partial<Pano> = {}): Pano =>
  ({ ancho: 2, alto: 2.4, color: '', ...extra }) as Pano;

const ventana = (extra: Partial<Ventana> = {}): Ventana =>
  ({
    id: Math.random().toString(36).slice(2),
    ubicacion: 'Living',
    codInt: 'BK 73',
    producto: 'ROLLER BLACKOUT',
    tipo: 'STANDARD',
    descripcion: 'EVEREST',
    color: '',
    alto: 2.4,
    precio: 0,
    cantidad: 1,
    categoria: 'ROL',
    grupoId: null,
    panos: [pano()],
    ...extra,
  }) as Ventana;

describe('familiaTexto', () => {
  it('reconoce dúo por categoría y por tipo de tela', () => {
    expect(familiaTexto(ventana({ categoria: 'DUO' }))).toBe('duo');
    expect(familiaTexto(ventana({ panos: [pano({ tipoTela: 'DU' })] }))).toBe('duo');
  });

  it('separa screen de blackout por el tipo de tela', () => {
    expect(familiaTexto(ventana({ panos: [pano({ tipoTela: 'SCR' })] }))).toBe('screen');
    expect(familiaTexto(ventana({ panos: [pano({ tipoTela: 'BK' })] }))).toBe('blackout');
  });

  it('los sistemas de oscuridad ganan sobre el tipo de tela', () => {
    // Un soft light se cotiza con tela blackout, pero su advertencia es la de
    // los perfiles, no la del blackout suelto.
    const v = ventana({ categoria: 'SOFT_LIGHT_38MM', panos: [pano({ tipoTela: 'BK' })] });
    expect(familiaTexto(v)).toBe('oscuridad');
  });

  it('la vertical tiene su propia advertencia', () => {
    expect(familiaTexto(ventana({ categoria: 'VERTICAL' }))).toBe('vertical');
  });
});

describe('esqueletoInforme — estructura', () => {
  it('sin ventanas devuelve vacío (no hay andamio que armar)', () => {
    expect(esqueletoInforme([])).toBe('');
    expect(esqueletoInforme(undefined)).toBe('');
  });

  it('numera una sección por ubicación, en el orden en que se cargaron', () => {
    const out = esqueletoInforme([
      ventana({ ubicacion: 'Living / Comedor' }),
      ventana({ ubicacion: 'Dormitorio 2' }),
      ventana({ ubicacion: 'Dormitorio Principal' }),
    ]);
    expect(out).toContain('1. Living / Comedor');
    expect(out).toContain('2. Dormitorio 2');
    expect(out).toContain('3. Dormitorio Principal');
  });

  it('dos cortinas de la MISMA ubicación comparten sección, no la duplican', () => {
    const out = esqueletoInforme([
      ventana({ ubicacion: 'Living', codInt: 'BK 73' }),
      ventana({ ubicacion: 'Living', codInt: 'SC 64', producto: 'ROLLER SCREEN' }),
    ]);
    expect(out).toContain('1. Living');
    expect(out).not.toContain('2. Living');
    expect(out).toContain('BK 73');
    expect(out).toContain('SC 64');
  });

  it('cortinas IDÉNTICAS en la misma ubicación se colapsan con su cantidad', () => {
    const out = esqueletoInforme([
      ventana({ ubicacion: 'Oficina' }),
      ventana({ ubicacion: 'Oficina' }),
      ventana({ ubicacion: 'Oficina' }),
    ]);
    expect(out).toContain('(×3)');
    expect(out.match(/Tipo de Cortina/g)).toHaveLength(1);
  });

  it('una ventana sin ubicación no rompe la numeración', () => {
    const out = esqueletoInforme([ventana({ ubicacion: '' })]);
    expect(out).toContain('1. (sin ubicación)');
  });
});

describe('esqueletoInforme — datos de cada cortina', () => {
  it('el tipo de cortina trae producto, código, descripción y cuántos paños', () => {
    const out = esqueletoInforme([
      ventana({ producto: 'ROLLER BLACKOUT', codInt: 'BK 73', descripcion: 'EVEREST' }),
    ]);
    expect(out).toContain('Tipo de Cortina: ROLLER BLACKOUT BK 73 EVEREST (1 paño entero)');
  });

  it('una cortina de 2 paños lo dice (suma un paso de luz al centro)', () => {
    const out = esqueletoInforme([ventana({ panos: [pano(), pano()] })]);
    expect(out).toContain('(2 paños)');
    expect(out).toContain('paso de luz al centro');
  });

  it('el color de accesorios cae al color de la VENTANA cuando el paño no trae el suyo', () => {
    // Trampa conocida: `colorAccesoriosDePano` hereda el color de la ventana.
    // Para que quede vacío hay que vaciar los dos.
    const conColorVentana = esqueletoInforme([ventana({ color: 'NEGRO', panos: [pano()] })]);
    expect(conColorVentana).toContain('Color de Accesorios: NEGRO');

    const sinColor = esqueletoInforme([ventana({ color: '', panos: [pano({ color: '' })] })]);
    expect(sinColor).not.toContain('Color de Accesorios');
  });

  it('el color del PAÑO gana sobre el de la ventana', () => {
    const out = esqueletoInforme([
      ventana({ color: 'BLANCO', panos: [pano({ colorMecanismo: 'NEGRO' })] }),
    ]);
    expect(out).toContain('Color de Accesorios: NEGRO');
  });

  it('la caída combina el sentido con la relación con el marco', () => {
    const out = esqueletoInforme([
      ventana({ sentido: 'INTERNO', panos: [pano({ relacionMarco: 'Dentro' })] }),
    ]);
    expect(out).toContain('Caída: Interna, instalada dentro del marco.');
  });

  it('sin sentido ni marco, la línea de caída no se inventa', () => {
    const out = esqueletoInforme([ventana({ sentido: '', panos: [pano()] })]);
    expect(out).not.toContain('Caída:');
  });
});

describe('esqueletoInforme — extras solo si existen', () => {
  it('el motor se nombra cuando lo hay', () => {
    const out = esqueletoInforme([ventana({ panos: [pano({ motorModelo: 'DOM 38' })] })]);
    expect(out).toContain('Motorizada: DOM 38.');
  });

  it('la cenefa se nombra con su advertencia de paso de luz superior', () => {
    const out = esqueletoInforme([ventana({ panos: [pano({ cenefa: 'Cuadrada a muro' })] })]);
    expect(out).toContain('Cenefa: Cuadrada a muro.');
    expect(out).toContain('paso de luz superior');
  });

  it('«No» y «Nada» NO generan línea: son la ausencia del extra', () => {
    const out = esqueletoInforme([ventana({ panos: [pano({ cenefa: 'No', cortes: 'Nada' })] })]);
    expect(out).not.toContain('Cenefa:');
    expect(out).not.toContain('se cortará');
  });

  it('el corte de rodapié se anuncia por cortina', () => {
    const out = esqueletoInforme([ventana({ panos: [pano({ cortes: 'Rodapié' })] })]);
    expect(out).toContain('se cortará rodapié');
  });
});

describe('esqueletoInforme — introducción', () => {
  it('solo aparecen las advertencias de las familias que la orden trae', () => {
    const soloDuo = esqueletoInforme([
      ventana({ categoria: 'DUO', panos: [pano({ tipoTela: 'DU' })] }),
    ]);
    expect(soloDuo).toContain('entre sus lamas y laterales');
    expect(soloDuo).not.toContain('laterales y en la parte superior');
  });

  it('una orden mixta trae las dos advertencias, sin repetirlas por cortina', () => {
    const out = esqueletoInforme([
      ventana({ categoria: 'DUO', panos: [pano({ tipoTela: 'DU' })] }),
      ventana({ categoria: 'DUO', panos: [pano({ tipoTela: 'DU' })] }),
      ventana({ panos: [pano({ tipoTela: 'BK' })] }),
    ]);
    expect(out.match(/entre sus lamas y laterales/g)).toHaveLength(1);
    expect(out.match(/laterales y en la parte superior/g)).toHaveLength(1);
  });
});

describe('tieneOscuridad', () => {
  it('detecta un sistema de oscuridad en la orden', () => {
    expect(tieneOscuridad([ventana({ categoria: 'SOFT_LIGHT_38MM' })])).toBe(true);
    expect(tieneOscuridad([ventana({ categoria: 'OSCURANTI_63MM' })])).toBe(true);
  });

  it('una orden de puro roller no lo tiene', () => {
    expect(tieneOscuridad([ventana(), ventana({ categoria: 'DUO' })])).toBe(false);
    expect(tieneOscuridad([])).toBe(false);
    expect(tieneOscuridad(undefined)).toBe(false);
  });
});
