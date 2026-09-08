// Vista "Historial técnico": lista de eventos filtrable por código, colmena
// o medida. Agrupa eventos por tubo_raiz_id y los separa en "vidas" (cada
// 'eliminado' rompe una vida). Detecta zombies (vidas que arrancan sin
// ingreso previo) y restauraciones (puntos de rollback admin).

import { useMemo, useState } from 'react';
import { Link2, Ruler, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EventoItem from '../components/EventoItem';
import EmptyState from '../components/EmptyState';
import { formatFechaHora } from '../utils/formato-fechas';
import type { Evento } from '../HistorialTubos.types';

interface VistaHistorialProps {
  empresaId: string | null | undefined;
}

type Vida = {
  eventos: Evento[];
  terminada: boolean; // último evento = 'eliminado'
  zombie: boolean;    // no es la primera vida Y no empezó con 'ingreso'
};

const splitVidas = (eventos: Evento[]): Vida[] => {
  if (eventos.length === 0) return [];
  const vidas: Evento[][] = [];
  let actual: Evento[] = [];
  for (const e of eventos) {
    actual.push(e);
    if (e.evento === 'eliminado') {
      vidas.push(actual);
      actual = [];
    }
  }
  if (actual.length > 0) vidas.push(actual);
  return vidas.map((evs, idx) => ({
    eventos: evs,
    terminada: evs[evs.length - 1]?.evento === 'eliminado',
    zombie: idx > 0 && evs[0]?.evento !== 'ingreso',
  }));
};

export default function VistaHistorial({ empresaId }: VistaHistorialProps) {
  const [cod, setCod] = useState('');
  const [colmena, setColmena] = useState('');
  const [medida, setMedida] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Evento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buscar = async () => {
    if (!empresaId) return;
    if (!cod.trim() && !colmena.trim() && !medida.trim()) {
      setError('Ingresa un código, colmena o medida para buscar.');
      setData(null);
      return;
    }
    let medidaNum: number | null = null;
    if (medida.trim()) {
      medidaNum = parseFloat(medida.trim().replace(',', '.'));
      if (!Number.isFinite(medidaNum) || medidaNum <= 0) {
        setError('La medida debe ser un número positivo (ej: 382 o 382.5).');
        setData(null);
        return;
      }
    }
    setLoading(true);
    setError(null);

    let q = supabase
      .from('tubos_historial')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (cod.trim()) q = q.ilike('cod', `%${cod.trim().toUpperCase()}%`);
    if (colmena.trim()) q = q.ilike('n_colmena', `%${colmena.trim().toUpperCase()}%`);
    if (medidaNum !== null) {
      // Tolerancia ±0.5 cm: cubre decimales (382 matchea 382.5) y errores
      // de redondeo en sobrantes calculados (382.50000000000003).
      q = q.gte('medida_cm', medidaNum - 0.5).lte('medida_cm', medidaNum + 0.5);
    }

    const { data: rows, error: err } = await q;
    setLoading(false);
    if (err) {
      setError(err.message);
      setData(null);
      return;
    }
    setData((rows as Evento[]) ?? []);
  };

  const grupos = useMemo(() => {
    if (!data) return [];
    const mapa = new Map<string, Evento[]>();
    for (const e of data) {
      const k = e.tubo_raiz_id ?? 'sin_raiz';
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(e);
    }
    return [...mapa.entries()];
  }, [data]);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          placeholder="Código de tubo (ej: BK10, DU90…)"
          value={cod}
          onChange={(e) => setCod(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-xs"
        />
        <Input
          placeholder="N° Colmena"
          value={colmena}
          onChange={(e) => setColmena(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-[160px]"
        />
        <Input
          placeholder="Medida cm (±0.5)"
          value={medida}
          onChange={(e) => setMedida(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          className="max-w-[160px]"
          inputMode="decimal"
          title="Medida del tubo en cm. Tolerancia ±0.5 cm. Útil para encontrar sobrantes (corte, sobrante_error) que no aparecen al buscar por código."
        />
        <Button onClick={buscar} disabled={loading}>
          <Search className="h-4 w-4" />
          {loading ? 'Buscando…' : 'Buscar'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          Ingresa el código o número de colmena de un tubo para ver su historial completo.
        </EmptyState>
      )}

      {data && data.length === 0 && (
        <EmptyState>
          <Ruler className="mx-auto mb-3 h-10 w-10" />
          No se encontraron eventos para ese tubo.
          <p className="mt-2 text-xs">
            El historial solo registra eventos desde que se implementó esta función.
          </p>
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <>
          <div className="mb-3 px-1 text-xs text-muted-foreground">
            <strong className="text-foreground">{data.length}</strong> eventos · Código(s):{' '}
            <strong className="text-primary">
              {[...new Set(data.map((e) => e.cod))].join(', ')}
            </strong>
          </div>
          {grupos.map(([raizId, eventos]) => {
            const primero = eventos[0];
            const tieneMerma = eventos.some((e) => e.evento === 'merma');
            const esLinaje = raizId !== 'sin_raiz';
            const vidas = splitVidas(eventos);
            const unaSolaVida = vidas.length <= 1;
            return (
              <div key={raizId} className="mb-3 overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h6 className="flex items-center gap-1.5 text-sm font-bold">
                    <Link2 className="h-4 w-4 text-primary" />
                    {primero.cod} · Colmena {primero.n_colmena ?? '—'}
                    {tieneMerma && (
                      <span className="ml-1 text-xs text-destructive">→ MERMA</span>
                    )}
                  </h6>
                  <span className="text-right text-xs text-muted-foreground">
                    {eventos.length} evento{eventos.length !== 1 ? 's' : ''}
                    {vidas.length > 1 && (
                      <>
                        {' · '}
                        <strong className="text-foreground">
                          {vidas.length} vidas
                        </strong>
                      </>
                    )}
                    {esLinaje && (
                      <>
                        <br />
                        <span className="font-mono text-[12px]">
                          ID:{raizId.slice(0, 8)}…
                        </span>
                      </>
                    )}
                  </span>
                </div>
                {unaSolaVida ? (
                  <ul className="py-2">
                    {eventos.map((e) => (
                      <EventoItem key={e.id} e={e} />
                    ))}
                  </ul>
                ) : (
                  vidas.map((v, i) => {
                    const esUltima = i === vidas.length - 1;
                    const estado = v.zombie
                      ? 'zombie'
                      : v.terminada
                        ? 'terminada'
                        : esUltima
                          ? 'actual'
                          : 'terminada';
                    const headerTone =
                      estado === 'zombie'
                        ? 'border-warning/30 bg-warning/15 text-warning'
                        : estado === 'actual'
                          ? 'border-success/30 bg-success/[0.06] text-success'
                          : 'border-border bg-muted/40 text-muted-foreground';
                    const label =
                      estado === 'zombie'
                        ? `Vida ${i + 1} · sin ingreso previo (fantasma)`
                        : estado === 'actual'
                          ? `Vida ${i + 1} · actual`
                          : `Vida ${i + 1} · terminada`;
                    const desde = v.eventos[0]?.created_at;
                    const hasta = v.eventos[v.eventos.length - 1]?.created_at;
                    return (
                      <div key={i}>
                        <div
                          className={cn(
                            'flex items-center justify-between border-y px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider',
                            headerTone,
                          )}
                        >
                          <span>
                            {estado === 'zombie' && '⚠ '}
                            {label}
                          </span>
                          <span className="font-normal normal-case tracking-normal opacity-70">
                            {formatFechaHora(desde)}
                            {desde !== hasta && <> → {formatFechaHora(hasta)}</>}
                          </span>
                        </div>
                        <ul className="py-2">
                          {v.eventos.map((e) => (
                            <EventoItem key={e.id} e={e} />
                          ))}
                        </ul>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
