// Dimensionado y Armado: la misma hoja CÁLCULO GENERAL con distinto recorte.
//
//   · Dimensionado — solo lo que corta la mesa de tela, más la columna
//     CONJUNTO PAÑOS con la letra de «cortar junto» del papel del cortador.
//   · Armado — la hoja completa, con la que se arma cada cortina.
//
// Armado además espera a que Estructura Y Dimensionado estén cerradas: es la
// única compuerta del taller que junta dos caminos que corrían en paralelo.

import { useMemo, useState } from 'react';
import { CircleCheckBig, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import {
  VARIANTE_CALCULO_GENERAL,
  VARIANTE_DIMENSIONADO,
  type ColumnaCalculo,
} from '@/modules/cotizador/calculoGeneral';
import type { OT } from '@/modules/ots/types';
import { calcularAvance, type AreasListas } from '@/modules/produccion/avance';
import {
  useCalculoGeneral,
  useChecks,
  useHojaLote,
  useOTsDelLote,
  usePanosDelRollo,
} from '@/modules/produccion/hooks';
import type { LoteProduccion } from '@/modules/produccion/lotes';
import PanosDelRollo from '@/components/cotizador/PanosDelRollo';
import TirosDelLote from '../components/TirosDelLote';
import BotonEmergencia from '../components/BotonEmergencia';
import HojaCalculo from '../components/HojaCalculo';

const CONJUNTO: ColumnaCalculo = { key: 'conjunto', label: 'CONJUNTO PAÑOS' };

export default function VistaCalculo({
  area,
  ot,
  otCargada,
  areasListas,
  onAreaCerrada,
  lote,
}: {
  area: 'dimensionado' | 'armado';
  ot: string;
  otCargada: OT | null;
  areasListas: AreasListas;
  onAreaCerrada: () => Promise<void>;
  /** El lote que se está trabajando: su tela se cortó junta. */
  lote?: LoteProduccion | null;
}) {
  const esDim = area === 'dimensionado';
  const variante = esDim ? VARIANTE_DIMENSIONADO : VARIANTE_CALCULO_GENERAL;

  // Dimensionando dentro de un lote, el tiro lo arma el LOTE: hay que traer
  // sus otras OTs para poder contar las cortinas que viajan en el mismo trozo.
  const idsLote = useMemo(
    () => (esDim && lote ? lote.ots.map((o) => o.id) : []),
    [esDim, lote],
  );
  const { ots: otsLote } = useOTsDelLote(idsLote);
  const { tiros, juntoPorOrden } = useHojaLote(otsLote);
  // La letra que ve esta OT sale del empaque del lote, no del suyo propio.
  const juntoDelLote = otCargada ? (juntoPorOrden.get(String(otCargada.id)) ?? null) : null;

  const { data, identidad, bloques, loading } = useCalculoGeneral(
    otCargada,
    variante,
    juntoDelLote,
  );
  // Solo Dimensionado dibuja los tiros: Armado ya no toca la tela.
  const { panos } = usePanosDelRollo(esDim ? otCargada : null);
  const { hechas, quien, areaLista, marcar, marcarAreaLista } = useChecks(area, ot);
  const [cerrando, setCerrando] = useState(false);

  // La letra del paño va al final, como en el PDF del Dimensionado.
  const identCols = useMemo(
    () => (variante.conjuntoPanos ? [...identidad, CONJUNTO] : identidad),
    [identidad, variante],
  );

  const avance = calcularAvance((data?.filas ?? []).map((f) => f.piezaId), hechas);

  // Armado junta los dos caminos del taller. No se BLOQUEA la pantalla —el
  // operario puede necesitar mirar la hoja antes— pero el aviso es claro.
  const faltaEstructura = !esDim && !areasListas.estructura;
  const faltaDimensionado = !esDim && !areasListas.dimensionado;
  const conCompuertaAbierta = !faltaEstructura && !faltaDimensionado;

  const alMarcar = async (clave: string, hecho: boolean) => {
    try {
      await marcar(clave, hecho);
    } catch (e) {
      toast.error('No se pudo guardar la marca: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const cerrarArea = async () => {
    if (avance.pct < 100) {
      const sigue = await confirmar({
        titulo: 'Faltan cortinas por marcar',
        mensaje: `Quedan ${avance.total - avance.hechas} cortinas sin marcar. ¿Igual cierras ${esDim ? 'el dimensionado' : 'el armado'}?`,
        confirmLabel: 'Sí, está listo',
      });
      if (!sigue) return;
    }
    if (!esDim && !conCompuertaAbierta) {
      const sigue = await confirmar({
        titulo: 'El taller todavía no termina lo anterior',
        mensaje: `Falta cerrar ${[faltaEstructura && 'Estructura', faltaDimensionado && 'Dimensionado'].filter(Boolean).join(' y ')}. ¿Igual das el armado por listo?`,
        confirmLabel: 'Sí, está listo',
      });
      if (!sigue) return;
    }
    setCerrando(true);
    try {
      await marcarAreaLista(true);
      await onAreaCerrada();
      toast.success(
        esDim ? 'Dimensionado listo.' : 'Armado listo. La OT pasa a Prueba.',
      );
    } catch (e) {
      toast.error('No se pudo cerrar el área: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCerrando(false);
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para ver su hoja de {esDim ? 'dimensionado' : 'armado'}.
      </p>
    );
  }

  if (!otCargada) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <BotonEmergencia area={area} ot={ot} />
        </div>
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no está en el sistema: la hoja se arma con las cortinas de la orden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {esDim
            ? 'Solo las medidas de tela: el metal y la cenefa los corta el taller, no esta mesa.'
            : 'La hoja completa de cada cortina, con todas sus piezas.'}
        </p>
        <div className="flex items-center gap-2">
          <BotonEmergencia area={area} ot={ot} />
          <Button size="sm" onClick={cerrarArea} disabled={cerrando || !data}>
            <CircleCheckBig className="mr-1.5 h-4 w-4" />
            {areaLista
              ? esDim
                ? 'Dimensionado listo ✓'
                : 'Armado listo ✓'
              : esDim
                ? 'Marcar dimensionado listo'
                : 'Marcar armado listo'}
          </Button>
        </div>
      </div>

      {!esDim && !conCompuertaAbierta && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            El armado espera a <strong>Estructura</strong> y <strong>Dimensionado</strong>. Falta
            cerrar {[faltaEstructura && 'Estructura', faltaDimensionado && 'Dimensionado']
              .filter(Boolean)
              .join(' y ')}
            . Puedes mirar la hoja igual, pero puede que las piezas todavía no estén.
          </span>
        </p>
      )}

      {/* Lo primero que ve el dimensionador cuando la tela se cortó en lote:
          el trozo real que le llega, con las cortinas de las dos órdenes. */}
      {esDim && lote && tiros.length > 0 && (
        <TirosDelLote nombre={lote.nombre} tiros={tiros} otActual={ot} />
      )}

      {loading && <p className="text-sm text-muted-foreground">Armando la hoja…</p>}

      {!loading && !data && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no tiene cortinas cargadas. Se agregan en Fase 2.
        </p>
      )}

      {data && (
        <HojaCalculo
          data={data}
          identidad={identCols}
          bloques={bloques}
          hechas={hechas}
          quien={quien}
          onMarcar={alMarcar}
          etiquetaCheck={esDim ? 'Dimensionada' : 'Armada'}
        />
      )}

      {/* El dimensionador recibe la tela enrollada desde la mesa de corte: acá
          ve cuántas cortinas salen de cada tiro y por dónde partirlo. Las letras
          son las mismas de la columna CONJUNTO PAÑOS y de la etiqueta del paño. */}
      {esDim && panos.length > 0 && (
        <div className="border-t border-border pt-4">
          <PanosDelRollo
            panos={panos}
            cliente={otCargada?.datosGenerales?.cliente}
            numeroOT={otCargada?.datosGenerales?.ot || ot}
            nota="Mismo formato de la pizarra: cada tela con su color, y por cortina el ancho arriba, el alto a la izquierda y la ubicación en su cajón. La letra es la misma de CONJUNTO PAÑOS y de la etiqueta del paño; el corte punteado marca por dónde parte."
          />
        </div>
      )}
    </div>
  );
}
