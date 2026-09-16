import { describe, expect, it } from 'vitest';
import {
  aoaPlanilla,
  ENCABEZADOS_EXCEL,
  FILTROS_PLANILLA_VACIOS,
  filaPlanilla,
  filtrarFilas,
  mesesDisponibles,
  numeroCotizacionCorto,
  semanaDelMes,
  ticketDeMonto,
  totalesPlanilla,
} from './planilla';
import type { Lead, LeadSeguimiento } from './types';

function lead(p: Partial<Lead> = {}): Lead {
  return {
    id: 'l1', empresa_id: 'e1', nombre: 'SEBASTIÁN', whatsapp_phone: '+56993191136', whatsapp_wa_id: null,
    email: 'sbonilla@mxandes.cl', rut: null, comuna: 'Las Condes', producto_interes: null, cantidad_ventanas: null,
    tiene_medidas: null, necesita_instalacion: null, urgencia: null, presupuesto_rango: null,
    resumen_para_vendedor: null, scoring: null, fuente: 'Instagram', estado: 'cotizado', motivo_derivacion: null,
    asignado_a: 'p1', asignado_at: null, tomado_at: null, ot_id: 'ot1', comentarios: null,
    ultima_actividad_at: '2026-09-16T15:00:00Z', created_at: '2026-09-16T15:00:00Z', updated_at: '2026-09-16T15:00:00Z',
    prioridad: 'alta', detalle_personal: null, fecha_cotizacion: '2026-09-16T15:00:00Z', etapa_seguimiento: 1,
    seg1_fecha: null, seg1_resultado: null, seg2_fecha: null, seg2_resultado: null, seg3_fecha: null,
    seg3_resultado: null, archivado: false, fecha_archivado: null, monto: 1_250_000, fecha_cierre: null,
    instagram: 'seba_bonilla', region: null, anuncio: 'Promo septiembre', mensaje: 'Roller dual 153 cm',
    llamada_por: 'Génesis', cotizado_por: 'Juan', visita_por: 'Alan',
    numero_cotizacion: 'N° COTJS - 07613 - SCREEN', estado_cotizacion: 'enviada', cotizacion_version: 1,
    origen_ot: true, ultima_actividad_por: 'p1', ultima_actividad_tipo: 'cotizacion',
    ...p,
  };
}

function seg(n: number, p: Partial<LeadSeguimiento> = {}): LeadSeguimiento {
  return {
    id: `s${n}`, lead_id: 'l1', empresa_id: 'e1', n, etapa: n <= 3 ? n : null,
    fecha: `2026-09-${String(16 + n).padStart(2, '0')}T15:00:00Z`, medio: 'whatsapp',
    resultado: 'no_respondio', nota: null, registrado_por: 'p1', created_at: '2026-09-17T15:00:00Z', ...p,
  };
}

const nombres = new Map([['p1', 'Camila Rojas']]);
const HOY = new Date('2026-09-18T15:00:00Z');

describe('ticketDeMonto — cortes del Excel', () => {
  it('bajo, medio y alto en los bordes', () => {
    expect(ticketDeMonto(499_999)).toBe('bajo');
    expect(ticketDeMonto(500_000)).toBe('medio');
    expect(ticketDeMonto(999_999)).toBe('medio');
    expect(ticketDeMonto(1_000_000)).toBe('alto');
  });

  it('sin monto no hay ticket', () => {
    expect(ticketDeMonto(0)).toBeNull();
    expect(ticketDeMonto(null)).toBeNull();
    expect(ticketDeMonto(Number.NaN)).toBeNull();
  });
});

describe('semanaDelMes (lunes a domingo)', () => {
  it('septiembre 2026 empieza martes: el 1 y el 6 son semana 1, el 7 es semana 2', () => {
    expect(semanaDelMes(new Date(2026, 8, 1))).toBe(1);
    expect(semanaDelMes(new Date(2026, 8, 6))).toBe(1);
    expect(semanaDelMes(new Date(2026, 8, 7))).toBe(2);
    expect(semanaDelMes(new Date(2026, 8, 16))).toBe(3);
    expect(semanaDelMes(new Date(2026, 8, 30))).toBe(5);
  });

  it('un mes que empieza lunes', () => {
    // junio 2026 empieza lunes
    expect(semanaDelMes(new Date(2026, 5, 1))).toBe(1);
    expect(semanaDelMes(new Date(2026, 5, 8))).toBe(2);
  });
});

describe('numeroCotizacionCorto', () => {
  it('saca el N° y la descripción', () => {
    expect(numeroCotizacionCorto('N° COTAP - #3194-G1 - VERTICALES')).toBe('COTAP - #3194-G1');
    expect(numeroCotizacionCorto('N° COTJS - 07979-5 -1  - VISITA- DUAL CON CENEFA OVALADA.')).toBe('COTJS - 07979-5 -1');
  });

  it('lo que no tiene descripción queda igual', () => {
    expect(numeroCotizacionCorto('N° COTLG - 06028')).toBe('COTLG - 06028');
    expect(numeroCotizacionCorto('#3238')).toBe('#3238');
    expect(numeroCotizacionCorto(null)).toBe('');
  });
});

describe('filaPlanilla', () => {
  it('arma las columnas del Excel', () => {
    const f = filaPlanilla(lead(), { seguimientos: [], nombres, hoy: HOY });
    expect(f.mes).toBe('SEP');
    expect(f.fecha).toBe('16-09-2026');
    expect(f.dia).toBe('MIÉRCOLES');
    expect(f.semana).toBe(3);
    expect(f.numeroCotizacion).toBe('COTJS - 07613');
    expect(f.ticket).toBe('alto');
    expect(f.vendedor).toBe('Camila Rojas');
    expect(f.region).toBe('Metropolitana');
    expect(f.canal).toBe('Instagram');
    expect(f.cotizacionFinal).toBeNull();
    expect(f.ultimoCambio).toBe('Estado de la cotización');
    expect(f.ultimoCambioQuien).toBe('Camila Rojas');
  });

  it('el canal «manual» no es un canal', () => {
    expect(filaPlanilla(lead({ fuente: 'manual' }), { seguimientos: [], nombres, hoy: HOY }).canal).toBe('');
  });

  it('seguimientos: los 3 primeros en columnas y el resto se cuenta', () => {
    const segs = [seg(2, { nota: 'Se deja audio' }), seg(1), seg(3, { medio: 'llamada' }), seg(4)];
    const f = filaPlanilla(lead(), { seguimientos: segs, nombres, hoy: HOY });
    expect(f.seguimientos[0]).toEqual({ fecha: '17-09-2026', medio: 'WhatsApp', medioExcel: 'VÍA WHATSAPP', respuesta: 'No respondió' });
    expect(f.seguimientos[1]?.respuesta).toBe('Se deja audio');
    expect(f.seguimientos[2]?.medio).toBe('Llamada');
    expect(f.seguimientosExtra).toBe(1);
    expect(f.respuesta).toBe('No respondió');
  });

  it('seguimiento pendiente y atrasado', () => {
    const f = filaPlanilla(lead(), { seguimientos: [], nombres, hoy: HOY });
    expect(f.estadoProceso).toBe('Seguimiento 1 pendiente · atrasado 1 d');
    expect(f.atrasado).toBe(true);
    expect(f.avisoAtraso).toBe('Seguimiento 1 atrasado 1 día · tocaba el 17-09-2026');
  });

  it('sin atraso no hay aviso', () => {
    const hoy = filaPlanilla(lead(), { seguimientos: [], nombres, hoy: new Date('2026-09-17T15:00:00Z') });
    expect(hoy.atrasado).toBe(false);
    expect(hoy.avisoAtraso).toBe('');
    const dos = filaPlanilla(lead(), { seguimientos: [], nombres, hoy: new Date('2026-09-19T15:00:00Z') });
    expect(dos.avisoAtraso).toBe('Seguimiento 1 atrasado 2 días · tocaba el 17-09-2026');
  });

  it('ganado lleva cotización final', () => {
    const f = filaPlanilla(lead({ estado: 'ganado' }), { seguimientos: [], nombres, hoy: HOY });
    expect(f.cotizacionFinal).toBe(1_250_000);
    expect(f.estadoProceso).toBe('Cerrado · ganado');
  });

  it('por actualizar se marca y muestra la versión', () => {
    const f = filaPlanilla(lead({ estado_cotizacion: 'por_actualizar', cotizacion_version: 2 }), {
      seguimientos: [],
      nombres,
      hoy: HOY,
    });
    expect(f.porActualizar).toBe(true);
    expect(f.estadoCotizacionTexto).toBe('Por actualizar · v2');
  });
});

describe('filtros y totales', () => {
  const filas = [
    filaPlanilla(lead(), { seguimientos: [], nombres, hoy: HOY }),
    filaPlanilla(lead({ id: 'l2', monto: 300_000, cotizado_por: 'Lisset', created_at: '2026-08-10T15:00:00Z', ot_id: null, estado: 'ganado' }), {
      seguimientos: [], nombres, hoy: HOY,
    }),
    filaPlanilla(lead({ id: 'l3', estado_cotizacion: 'por_actualizar', archivado: true }), { seguimientos: [], nombres, hoy: HOY }),
  ];

  it('filtra por mes, persona, ticket y archivados', () => {
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, mes: '2026-08' }).map((f) => f.id)).toEqual(['l2']);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, persona: 'Lisset' }).map((f) => f.id)).toEqual(['l2']);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, persona: 'Alan' })).toHaveLength(3);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, ticket: 'bajo' }).map((f) => f.id)).toEqual(['l2']);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, ocultarArchivados: true })).toHaveLength(2);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, soloConCotizacion: true })).toHaveLength(2);
    expect(filtrarFilas(filas, { ...FILTROS_PLANILLA_VACIOS, estadoCotizacion: 'por_actualizar' }).map((f) => f.id)).toEqual(['l3']);
  });

  it('meses del más nuevo al más viejo', () => {
    expect(mesesDisponibles(filas)).toEqual([
      { valor: '2026-09', texto: 'SEP 2026' },
      { valor: '2026-08', texto: 'AGO 2026' },
    ]);
  });

  it('totales', () => {
    expect(totalesPlanilla(filas)).toEqual({ filas: 3, cotizado: 2_800_000, ganado: 300_000, porActualizar: 1 });
  });
});

describe('aoaPlanilla', () => {
  it('encabezados del Excel y una fila con el mismo largo', () => {
    const aoa = aoaPlanilla([filaPlanilla(lead(), { seguimientos: [seg(1)], nombres, hoy: HOY })]);
    expect(aoa[0]).toEqual([...ENCABEZADOS_EXCEL]);
    expect(aoa[0].slice(0, 8)).toEqual(['MES', 'N° DE SEMANA', 'FECHA', 'DÍA', 'NOMBRE DE CLIENTE', 'TELÉFONO', 'INSTAGRAM', 'ESTADO COTIZACIÓN']);
    expect(aoa[1]).toHaveLength(aoa[0].length);
    expect(aoa[1][7]).toBe('ENVIADA');
    expect(aoa[1][aoa[0].indexOf('SEGUIMIENTO 1')]).toBe('SI');
    expect(aoa[1][aoa[0].indexOf('TIPO DE SEGUIMIENTO 1')]).toBe('VÍA WHATSAPP');
    expect(aoa[1][aoa[0].indexOf('SEGUIMIENTO 2')]).toBe('');
    expect(aoa[1][aoa[0].indexOf('MONTO COTIZADO')]).toBe(1_250_000);
  });
});
