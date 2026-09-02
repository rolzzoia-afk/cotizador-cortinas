// Estructura: el plan de corte de tubos y perfiles, en pantalla.
//
// Es la primera área del taller y corre en paralelo con Paños. Al cerrarla, la
// OT solo avanza si los paños ya estaban listos (la compuerta vive en
// `calcularSubEtapa`).

import { useState } from 'react';
import { CircleCheckBig } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { calcularAvance } from '@/modules/produccion/avance';
import { useChecks, usePlanDeOT } from '@/modules/produccion/hooks';
import BotonEmergencia from '../components/BotonEmergencia';
import HojaPlanCorte from '../components/HojaPlanCorte';

export default function VistaEstructura({
  ot,
  onAreaCerrada,
}: {
  ot: string;
  onAreaCerrada: () => Promise<void>;
}) {
  const { plan, loading, error } = usePlanDeOT(ot);
  const { hechas, quien, areaLista, marcar, marcarAreaLista } = useChecks(
    'estructura',
    ot,
    plan?.id ?? '',
  );
  const [cerrando, setCerrando] = useState(false);

  const clavesCorte = (plan?.filas ?? []).filter((f) => f.tipo === 'corte').map((f) => f.clave);
  const avance = calcularAvance(clavesCorte, hechas);

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
        titulo: 'Faltan cortes por marcar',
        mensaje: `Quedan ${avance.total - avance.hechas} cortes sin marcar. ¿Igual das la estructura por lista?`,
        confirmLabel: 'Sí, está lista',
      });
      if (!sigue) return;
    }
    setCerrando(true);
    try {
      await marcarAreaLista(true);
      await onAreaCerrada();
      toast.success('Estructura marcada como lista.');
    } catch (e) {
      toast.error('No se pudo cerrar el área: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCerrando(false);
    }
  };

  if (!ot) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Busca una OT arriba para ver su plan de corte.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {plan ? (
            <>
              Plan del{' '}
              {plan.fecha ? new Date(plan.fecha).toLocaleDateString('es-CL') : 'sin fecha'} ·{' '}
              <span className="font-semibold text-foreground">{plan.ots.join(' · ')}</span>
            </>
          ) : (
            ' '
          )}
        </div>
        <div className="flex items-center gap-2">
          <BotonEmergencia area="estructura" ot={ot} />
          <Button size="sm" onClick={cerrarArea} disabled={cerrando || !plan}>
            <CircleCheckBig className="mr-1.5 h-4 w-4" />
            {areaLista ? 'Estructura lista ✓' : 'Marcar estructura lista'}
          </Button>
        </div>
      </div>

      {plan && !plan.exacto && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
          No hay un plan escrito exactamente como «{ot}». Este es el más parecido:{' '}
          <strong>{plan.ots.join(' · ')}</strong>. Revísalo antes de cortar.
        </p>
      )}

      {loading && <p className="text-sm text-muted-foreground">Buscando el plan de corte…</p>}

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          No se pudo leer el plan: {error}
        </p>
      )}

      {!loading && !error && !plan && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          La OT {ot} todavía no tiene plan de corte de estructura. El plan se genera en el módulo{' '}
          <strong className="text-foreground">Optimizador</strong> (menú de arriba): se carga la
          orden, <strong className="text-foreground">Calcular</strong> y{' '}
          <strong className="text-foreground">Confirmar</strong> — eso descuenta la colmena de
          tubos y guarda el plan. Apenas exista, esta pantalla se llena sola.
        </p>
      )}

      {plan && (
        <HojaPlanCorte filas={plan.filas} hechas={hechas} quien={quien} onMarcar={alMarcar} />
      )}
    </div>
  );
}
