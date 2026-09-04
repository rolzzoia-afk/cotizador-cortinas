// Corte de paños: la hoja de corte de tela en pantalla.
//
// Corre en paralelo con Estructura. Al cerrarla, la OT pasa a Dimensionado
// (la compuerta vive en `calcularSubEtapa`).

import { useMemo, useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import type { OT } from '@/modules/ots/types';
import { calcularAvance } from '@/modules/produccion/avance';
import { useChecks, useHojaCorte, useOTsDelLote } from '@/modules/produccion/hooks';
import type { LoteProduccion } from '@/modules/produccion/lotes';
import { clavesDePano, clavesDeSeccion } from '@/modules/produccion/panos';
import BotonEmergencia from '../components/BotonEmergencia';
import HojaCortePanos from '../components/HojaCortePanos';

export default function VistaPanos({
  ot,
  otCargada,
  lote,
  onAreaCerrada,
}: {
  ot: string;
  otCargada: OT | null;
  /** El lote que se está trabajando: su tela se corta junta, con un solo plan. */
  lote?: LoteProduccion | null;
  onAreaCerrada: () => Promise<void>;
}) {
  // Dentro de un lote el plan se arma con TODAS sus OTs: si no, esta pantalla
  // podría asignarle un paño del rack que otra orden del lote ya se llevó.
  const idsLote = useMemo(() => (lote ? lote.ots.map((o) => o.id) : []), [lote]);
  const { ots: otsLote } = useOTsDelLote(idsLote);
  const { rows, hoja, principal, vertical, nombreDeTela, loading, error } = useHojaCorte(
    otCargada,
    { otsDelPlan: otsLote },
  );
  const { hechas, quien, areaLista, marcar, marcarAreaLista } = useChecks('panos', ot);
  const [cerrando, setCerrando] = useState(false);

  const claves = useMemo(
    () => (hoja && otCargada ? clavesDePano(hoja.cortinas, rows, otCargada.id) : new Map()),
    [hoja, rows, otCargada],
  );

  const avance = calcularAvance(clavesDeSeccion(hoja?.panos ?? [], claves), hechas);

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
        titulo: 'Faltan paños por marcar',
        mensaje: `Quedan ${avance.total - avance.hechas} paños sin marcar. ¿Igual das los paños por listos?`,
        confirmLabel: 'Sí, están listos',
      });
      if (!sigue) return;
    }
    setCerrando(true);
    try {
      await marcarAreaLista(true);
      await onAreaCerrada();
      toast.success('Paños marcados como listos. La OT pasa a Dimensionado.');
    } catch (e) {
      toast.error('No se pudo cerrar el área: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCerrando(false);
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para ver su hoja de corte de paños.
      </p>
    );
  }

  if (!otCargada) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <BotonEmergencia area="panos" ot={ot} />
        </div>
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no está en el sistema, así que no hay paños que calcular. La hoja de corte se
          arma con las cortinas de la orden.
        </p>
      </div>
    );
  }

  const hayPrincipal = (principal?.cortinas.length ?? 0) > 0;
  const hayVertical = (vertical?.cortinas.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Se marca el <strong className="text-foreground">paño</strong>, no la cortina: de un paño
          salen todas las que se cortan juntas.
        </p>
        <div className="flex items-center gap-2">
          <BotonEmergencia area="panos" ot={ot} />
          <Button size="sm" onClick={cerrarArea} disabled={cerrando || !hoja}>
            <CircleCheckBig className="mr-1.5 h-4 w-4" />
            {areaLista ? 'Paños listos ✓' : 'Marcar paños listos'}
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Armando la hoja de corte…</p>}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          No se pudieron leer los sobrantes de la colmena: {error}. La hoja igual se puede cortar,
          pero puede estar mandando al rollo paños que ya existen como retazo.
        </p>
      )}

      {!loading && !hoja && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} no tiene paños. Se cargan agregando las cortinas en Fase 2.
        </p>
      )}

      {hayPrincipal && principal && (
        <HojaCortePanos
          titulo="Hoja de corte paño"
          hoja={principal}
          claves={claves}
          hechas={hechas}
          quien={quien}
          onMarcar={alMarcar}
          nombreDeTela={nombreDeTela}
        />
      )}

      {hayVertical && vertical && (
        <HojaCortePanos
          titulo="Hoja de corte de paño vertical"
          banner="Paños / colmena solo para cortinas verticales"
          hoja={vertical}
          claves={claves}
          hechas={hechas}
          quien={quien}
          onMarcar={alMarcar}
          nombreDeTela={nombreDeTela}
        />
      )}
    </div>
  );
}
