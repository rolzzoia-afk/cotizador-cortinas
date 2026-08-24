import { describe, expect, it } from 'vitest';
import { folioOtDetallada, inicialesVendedor, otDetalladaSugerida, tipoDeItem } from './otDetallada';

const item = (cod: string, nombre = '') => ({ cod, nombre });

describe('tipoDeItem', () => {
  it('la vertical se nombra por vertical, no por su tela', () => {
    expect(tipoDeItem(item('BLACKOUT_V_P', 'CORTINA VERTICAL BLACKOUT PREMIUM'))).toBe('VERTICALES');
    expect(tipoDeItem(item('SCREEN_V_S', 'ROLLER SCREEN DELUX VERTICAL'))).toBe('VERTICALES');
  });

  it('el dúo se nombra DUAL, como lo escribe la vendedora', () => {
    expect(tipoDeItem(item('DUOBK_P', 'ROLLER DUO BLACKOUT PREMIUM'))).toBe('DUAL');
    expect(tipoDeItem(item('DUOPOLI_S', 'ROLLER DUO POLIESTER STANDARD'))).toBe('DUAL');
  });

  it('reconoce los sistemas propios', () => {
    expect(tipoDeItem(item('BEE_BK', 'BEEBLACK BLACKOUT'))).toBe('BEEBLACK');
    expect(tipoDeItem(item('OSC_01', 'CORTINA OSCURIDAD 38'))).toBe('OSCURIDAD');
    expect(tipoDeItem(item('DARK_45', 'ROLLER DARK 45'))).toBe('DARK');
    expect(tipoDeItem(item('SL_38', 'ROLLER SOFT LIGHT 38'))).toBe('SOFT LIGHT');
  });

  it('el roller simple se nombra por su tela', () => {
    expect(tipoDeItem(item('SCREEN_P', 'ROLLER SCREEN PREMIUM'))).toBe('SCREEN');
    expect(tipoDeItem(item('BLACKOUT_D', 'ROLLER BLACKOUT DELUX'))).toBe('BLACKOUT');
  });

  it('un código desconocido no inventa un tipo', () => {
    expect(tipoDeItem(item('XX_99', 'ALGO NUEVO'))).toBe('');
  });
});

describe('el folio COT + iniciales', () => {
  it('toma la inicial del nombre y la del apellido', () => {
    // El COTAP de la carpeta de referencias es Antonio Pascuzzo.
    expect(inicialesVendedor('Antonio Pascuzzo')).toBe('AP');
    expect(inicialesVendedor('Jeferson Sanhueza')).toBe('JS');
    expect(inicialesVendedor('  soledad   muñoz ')).toBe('SM');
  });

  it('con nombre compuesto usa el primero y el último', () => {
    expect(inicialesVendedor('María José Pérez Rojas')).toBe('MR');
  });

  it('un nombre de una sola palabra no rompe el formato', () => {
    expect(inicialesVendedor('Diego')).toBe('DI');
  });

  it('sin nombre usable no inventa letras', () => {
    expect(inicialesVendedor('')).toBe('');
    expect(inicialesVendedor('   ')).toBe('');
  });

  it('arma el folio con el número de la OT, sin inventarlo', () => {
    expect(folioOtDetallada('3201', 'Antonio Pascuzzo')).toBe('N° COTAP - 3201');
    expect(folioOtDetallada('268-12', 'Camila Rojas')).toBe('N° COTCR - 268-12');
  });

  it('sin vendedor conocido el folio va sin COT', () => {
    expect(folioOtDetallada('3201', '')).toBe('N° 3201');
  });

  it('un número que ya trae el folio completo se respeta', () => {
    expect(folioOtDetallada('COTJS-10427-1', 'Antonio Pascuzzo')).toBe('N° COTJS-10427-1');
    expect(folioOtDetallada('N° COTJS - 07979-5 -1', 'Antonio Pascuzzo')).toBe(
      'N° COTJS - 07979-5 -1',
    );
  });

  it('sin número no hay folio', () => {
    expect(folioOtDetallada('', 'Antonio Pascuzzo')).toBe('');
  });
});

describe('otDetalladaSugerida', () => {
  it('arma el folio con las iniciales de quien está cotizando', () => {
    expect(
      otDetalladaSugerida({
        numero: '3201',
        vendedor: 'Antonio Pascuzzo',
        conVisita: true,
        cortinas: [item('DUOBK_P', 'ROLLER DUO BLACKOUT PREMIUM')],
        adicionales: [],
      }),
    ).toBe('N° COTAP - 3201 - VISITA - DUAL');
  });

  it('arma el texto que hoy se escribe a mano', () => {
    expect(
      otDetalladaSugerida({
        numero: 'COTJS - 07979-5 -1',
        vendedor: '',
        conVisita: true,
        cortinas: [
          item('BLACKOUT_V_P', 'CORTINA VERTICAL BLACKOUT PREMIUM'),
          item('DUOBK_P', 'ROLLER DUO BLACKOUT PREMIUM'),
        ],
        adicionales: [item('CENF C', 'CENEFA CUADRADA')],
      }),
    ).toBe('N° COTJS - 07979-5 -1 - VISITA - VERTICALES Y DUAL CON CENEFA CUADRADA');
  });

  it('sin visita no la nombra', () => {
    expect(
      otDetalladaSugerida({
        numero: '3201',
        vendedor: '',
        conVisita: false,
        cortinas: [item('SCREEN_P', 'ROLLER SCREEN PREMIUM')],
        adicionales: [],
      }),
    ).toBe('N° 3201 - SCREEN');
  });

  it('no repite un tipo aunque haya varias cortinas iguales', () => {
    const t = otDetalladaSugerida({
      numero: '10',
      vendedor: '',
      conVisita: false,
      cortinas: [
        item('DUOBK_P', 'ROLLER DUO BLACKOUT PREMIUM'),
        item('DUOBK_P', 'ROLLER DUO BLACKOUT PREMIUM'),
        item('DUOPOLI_S', 'ROLLER DUO POLIESTER STANDARD'),
      ],
      adicionales: [],
    });
    expect(t).toBe('N° 10 - DUAL');
  });

  it('los tipos salen siempre en el mismo orden, no en el de la grilla', () => {
    const a = otDetalladaSugerida({
      numero: '',
      vendedor: '',
      conVisita: false,
      cortinas: [item('DUOBK_P', 'ROLLER DUO BLACKOUT'), item('SCREEN_V_P', 'VERTICAL SCREEN')],
      adicionales: [],
    });
    const b = otDetalladaSugerida({
      numero: '',
      vendedor: '',
      conVisita: false,
      cortinas: [item('SCREEN_V_P', 'VERTICAL SCREEN'), item('DUOBK_P', 'ROLLER DUO BLACKOUT')],
      adicionales: [],
    });
    expect(a).toBe('VERTICALES Y DUAL');
    expect(b).toBe(a);
  });

  it('distingue la cenefa cuadrada de la ovalada por la letra del código', () => {
    const con = (cod: string) =>
      otDetalladaSugerida({
        numero: '',
        vendedor: '',
        conVisita: false,
        cortinas: [item('BLACKOUT_P', 'ROLLER BLACKOUT PREMIUM')],
        adicionales: [item(cod, '')],
      });
    expect(con('CENF C')).toBe('BLACKOUT CON CENEFA CUADRADA');
    expect(con('CENF O')).toBe('BLACKOUT CON CENEFA OVALADA');
  });

  it('nombra el motor y encadena los extras', () => {
    expect(
      otDetalladaSugerida({
        numero: '',
        vendedor: '',
        conVisita: false,
        cortinas: [item('BLACKOUT_P', 'ROLLER BLACKOUT PREMIUM')],
        adicionales: [item('CENF C', ''), item('DOM38', 'MOTOR TUBULAR')],
      }),
    ).toBe('BLACKOUT CON CENEFA CUADRADA Y MOTOR');
  });

  it('una cortina de código desconocido igual aparece', () => {
    expect(
      otDetalladaSugerida({
        numero: '7',
        vendedor: '',
        conVisita: false,
        cortinas: [item('XX_99', 'ALGO NUEVO')],
        adicionales: [],
      }),
    ).toBe('N° 7 - CORTINAS');
  });

  it('sin nada que describir devuelve vacío (el folio ya va en su celda)', () => {
    expect(
      otDetalladaSugerida({ numero: '3201', vendedor: '', conVisita: true, cortinas: [], adicionales: [] }),
    ).toBe('');
  });

  it('no duplica el «N°» si el número ya lo trae', () => {
    expect(
      otDetalladaSugerida({
        numero: 'N° COTJS - 10427-1',
        vendedor: '',
        conVisita: false,
        cortinas: [item('BLACKOUT_P', 'ROLLER BLACKOUT PREMIUM')],
        adicionales: [],
      }),
    ).toBe('N° COTJS - 10427-1 - BLACKOUT');
  });
});
