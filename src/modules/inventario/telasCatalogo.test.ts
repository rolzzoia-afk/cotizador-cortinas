import { describe, expect, it } from 'vitest';
import {
  avanceMinimo,
  descripcionTela,
  estadoTela,
  filtrarTelas,
  FILTROS_TELAS_VACIOS,
  nombreFamilia,
  opcionesTelas,
  ordenarTelas,
  resumenTelas,
  saldoTela,
  textoMetros,
  textoRollos,
  tieneAncho,
  type TelaCatalogo,
} from './telasCatalogo';

function tela(p: Partial<TelaCatalogo> & { codigo: string }): TelaCatalogo {
  return {
    tipo: 'BK',
    grupo: 'BLANCO',
    nemotecnico: null,
    descriptor: null,
    proveedor: 'FABRICS',
    cod_ext: null,
    posicion: null,
    almacen: 'LIBERADO',
    estado: 'ACTIVO',
    status_stock: null,
    ancho: 2.98,
    metros_rollo: null,
    stock_minimo: 20,
    stock_mp: 0,
    stock_liberado: 0,
    ...p,
  };
}

// El catálogo de la lámina, con los números que se ven en pantalla.
const CATALOGO: TelaCatalogo[] = [
  tela({ codigo: 'BK 07', nemotecnico: 'Blackout arena', stock_mp: 42, stock_liberado: 44.2 }),
  tela({
    codigo: 'BK 41',
    nemotecnico: 'Blackout blanco textura',
    ancho: null,
    stock_mp: 18.5,
    stock_minimo: 25,
  }),
  tela({
    codigo: 'BK 90',
    nemotecnico: 'Blackout gris plomo',
    ancho: null,
    stock_liberado: 6.8,
    grupo: 'MARENGO',
  }),
  tela({
    codigo: 'DU 12',
    tipo: 'DU',
    nemotecnico: 'Dúo blackout beige',
    ancho: 2.8,
    stock_mp: 31,
    stock_liberado: 12.4,
    almacen: 'MATERIAS PRIMAS',
    grupo: 'BEIGE',
    proveedor: 'TAMITEX',
  }),
  tela({
    codigo: 'SC 12',
    tipo: 'SC',
    nemotecnico: 'Screen 3 % gris',
    stock_mp: 22,
    stock_liberado: 22.6,
    grupo: 'MARENGO',
  }),
  tela({
    codigo: 'VE 21',
    tipo: 'VE',
    nemotecnico: 'Vertical lino crudo',
    ancho: 2.8,
    estado: 'DESCONTINUADO',
    grupo: 'LINO',
  }),
];

describe('nombreFamilia', () => {
  it('traduce los códigos que existen', () => {
    expect(nombreFamilia('BK')).toBe('Blackout');
    expect(nombreFamilia('du')).toBe('Dúo');
    expect(nombreFamilia('SC')).toBe('Screen');
  });

  it('un tipo desconocido se muestra tal cual, sin renombrarlo', () => {
    expect(nombreFamilia('XZ')).toBe('XZ');
  });

  it('sin tipo no inventa una familia', () => {
    expect(nombreFamilia(null)).toBe('—');
    expect(nombreFamilia('  ')).toBe('—');
  });
});

describe('descripcionTela', () => {
  it('el nemotécnico es el nombre de la casa', () => {
    expect(descripcionTela(tela({ codigo: 'BK 07', nemotecnico: 'Blackout arena' }))).toBe(
      'Blackout arena',
    );
  });

  it('sin nemotécnico cae al descriptor del proveedor', () => {
    expect(
      descripcionTela(tela({ codigo: 'BK 08', nemotecnico: '  ', descriptor: 'BLANCO ESTANDAR' })),
    ).toBe('BLANCO ESTANDAR');
  });

  it('sin ninguno de los dos no inventa un nombre', () => {
    expect(descripcionTela(tela({ codigo: 'BK 09' }))).toBe('—');
  });
});

describe('saldoTela', () => {
  it('suma las dos bodegas', () => {
    expect(saldoTela(tela({ codigo: 'X', stock_mp: 42, stock_liberado: 44.2 }))).toBeCloseTo(86.2);
  });

  it('un saldo nulo cuenta como cero, no como desconocido', () => {
    expect(saldoTela(tela({ codigo: 'X', stock_mp: null, stock_liberado: 6.8 }))).toBe(6.8);
  });
});

describe('textoMetros', () => {
  it('dos decimales con coma', () => {
    expect(textoMetros(86.2)).toBe('86,20');
    expect(textoMetros(0)).toBe('0,00');
  });

  it('sin dato no muestra un cero que no es cero', () => {
    expect(textoMetros(null)).toBe('—');
    expect(textoMetros(undefined)).toBe('—');
  });
});

describe('textoRollos', () => {
  it('redondea al rollo más cercano', () => {
    expect(textoRollos(86.2, 30)).toBe('≈ 3');
    expect(textoRollos(43.4, 30)).toBe('≈ 1');
  });

  it('menos de un rollo se dice así, no «0»', () => {
    expect(textoRollos(6.8, 30)).toBe('< 1');
  });

  it('sin metros por rollo declarados NO supone un largo', () => {
    expect(textoRollos(86.2, null)).toBe('—');
    expect(textoRollos(86.2, 0)).toBe('—');
  });

  it('sin metros no hay rollos', () => {
    expect(textoRollos(0, 30)).toBe('—');
  });
});

describe('avanceMinimo', () => {
  it('la barra se llena cuando el mínimo queda cubierto', () => {
    expect(avanceMinimo(20, 20)).toBe(100);
    expect(avanceMinimo(86.2, 20)).toBe(100);
    expect(avanceMinimo(10, 20)).toBe(50);
  });

  it('sin mínimo definido no hay barra', () => {
    expect(avanceMinimo(50, null)).toBeNull();
    expect(avanceMinimo(50, 0)).toBeNull();
  });

  it('un saldo negativo se dibuja vacío, no al revés', () => {
    expect(avanceMinimo(-4, 20)).toBe(0);
  });
});

describe('estadoTela', () => {
  it('lo descontinuado gana a todo: ya no se repone', () => {
    expect(estadoTela(tela({ codigo: 'X', estado: 'DESCONTINUADO', stock_mp: 40 }))).toBe(
      'descontinuado',
    );
  });

  it('bajo el mínimo avisa', () => {
    expect(estadoTela(tela({ codigo: 'X', stock_mp: 6.8, stock_minimo: 20 }))).toBe('bajo_minimo');
  });

  it('sin mínimo definido nunca sale «bajo mínimo»', () => {
    expect(estadoTela(tela({ codigo: 'X', stock_mp: 1, stock_minimo: null }))).toBe('sin_minimo');
  });
});

describe('tieneAncho', () => {
  it('reconoce la tela sin ancho de rollo registrado', () => {
    expect(tieneAncho(tela({ codigo: 'X', ancho: 2.98 }))).toBe(true);
    expect(tieneAncho(tela({ codigo: 'X', ancho: null }))).toBe(false);
    expect(tieneAncho(tela({ codigo: 'X', ancho: 0 }))).toBe(false);
  });
});

describe('filtrarTelas', () => {
  it('sin filtros no esconde nada', () => {
    expect(filtrarTelas(CATALOGO, FILTROS_TELAS_VACIOS)).toHaveLength(CATALOGO.length);
  });

  it('busca por código, nombre y proveedor sin importar mayúsculas', () => {
    const porCodigo = filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, busqueda: 'du 12' });
    expect(porCodigo.map((t) => t.codigo)).toEqual(['DU 12']);
    const porNombre = filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, busqueda: 'gris' });
    expect(porNombre.map((t) => t.codigo)).toEqual(['BK 90', 'SC 12']);
    const porProveedor = filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, busqueda: 'tamitex' });
    expect(porProveedor.map((t) => t.codigo)).toEqual(['DU 12']);
  });

  it('la familia filtra por `tipo` y el color por `grupo`', () => {
    expect(
      filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, familia: 'BK' }).map((t) => t.codigo),
    ).toEqual(['BK 07', 'BK 41', 'BK 90']);
    expect(
      filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, color: 'MARENGO' }).map((t) => t.codigo),
    ).toEqual(['BK 90', 'SC 12']);
  });

  it('el almacén entiende las dos grafías de materias primas', () => {
    expect(
      filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, almacen: 'MP' }).map((t) => t.codigo),
    ).toEqual(['DU 12']);
  });

  it('«solo bajo mínimo» junta lo que falta y lo que se acabó, pero no lo descontinuado', () => {
    const faltan = filtrarTelas(CATALOGO, { ...FILTROS_TELAS_VACIOS, soloBajoMinimo: true });
    expect(faltan.map((t) => t.codigo)).toEqual(['BK 41', 'BK 90']);
  });

  it('dos filtros se cruzan, no se suman', () => {
    const r = filtrarTelas(CATALOGO, {
      ...FILTROS_TELAS_VACIOS,
      familia: 'BK',
      color: 'MARENGO',
    });
    expect(r.map((t) => t.codigo)).toEqual(['BK 90']);
  });
});

describe('ordenarTelas', () => {
  it('ordena los metros como números, no como texto', () => {
    const r = ordenarTelas(CATALOGO, 'total', 'desc');
    expect(r.map((t) => t.codigo)).toEqual(['BK 07', 'SC 12', 'DU 12', 'BK 41', 'BK 90', 'VE 21']);
  });

  it('el empate lo desempata el código, para que la lista no baile', () => {
    const empatados = [
      tela({ codigo: 'SC 12', stock_mp: 0 }),
      tela({ codigo: 'BK 07', stock_mp: 0 }),
    ];
    expect(ordenarTelas(empatados, 'total', 'desc').map((t) => t.codigo)).toEqual([
      'BK 07',
      'SC 12',
    ]);
  });

  it('no toca la lista original', () => {
    const antes = CATALOGO.map((t) => t.codigo);
    ordenarTelas(CATALOGO, 'total', 'desc');
    expect(CATALOGO.map((t) => t.codigo)).toEqual(antes);
  });

  it('el ancho sin declarar se va al final al ordenar de mayor a menor', () => {
    const r = ordenarTelas(CATALOGO, 'ancho', 'desc');
    expect(r.slice(-2).map((t) => t.codigo)).toEqual(['BK 41', 'BK 90']);
  });
});

describe('resumenTelas', () => {
  it('cuenta lo que dice la línea del encabezado', () => {
    expect(resumenTelas(CATALOGO)).toEqual({
      total: 6,
      conStock: 5,
      bajoMinimo: 2,
      sinAncho: 2,
    });
  });

  it('un catálogo vacío no revienta', () => {
    expect(resumenTelas([])).toEqual({ total: 0, conStock: 0, bajoMinimo: 0, sinAncho: 0 });
  });
});

describe('opcionesTelas', () => {
  it('solo ofrece lo que existe de verdad en la lista', () => {
    const o = opcionesTelas(CATALOGO);
    expect(o.familias).toEqual([
      { id: 'BK', texto: 'Blackout' },
      { id: 'DU', texto: 'Dúo' },
      { id: 'SC', texto: 'Screen' },
      { id: 'VE', texto: 'Vertical' },
    ]);
    expect(o.colores).toEqual(['BEIGE', 'BLANCO', 'LINO', 'MARENGO']);
    expect(o.almacenes).toEqual(['LIB', 'MP']);
    expect(o.proveedores).toEqual(['FABRICS', 'TAMITEX']);
  });

  it('no ofrece un almacén que no se reconoce', () => {
    const o = opcionesTelas([tela({ codigo: 'X', almacen: 'EL PATIO' })]);
    expect(o.almacenes).toEqual([]);
  });
});
