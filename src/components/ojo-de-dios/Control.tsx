import { useMemo, useState } from 'react';
import { Activity, Loader2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useVersionMinima } from '@/modules/admin/hooks';
import type { OT } from '@/modules/ots/types';
import type { Tela } from '@/modules/admin/types';
import { confirmar } from '@/components/ui/confirm';

type Props = {
  ots: OT[];
  telas: Tela[];
  online: boolean;
};

export function Control({ ots, telas, online }: Props) {
  const { version, loading, forzarActualizacion } = useVersionMinima();
  const [forzando, setForzando] = useState(false);

  const ultima = useMemo(() => {
    const sorted = [...ots].sort((a, b) =>
      (b.fechaModificacion || '').localeCompare(a.fechaModificacion || ''),
    );
    return sorted[0]?.fechaModificacion?.slice(0, 10) || '—';
  }, [ots]);

  const forzar = async () => {
    const nueva = version
      ? (Math.round((parseFloat(version) + 0.1) * 10) / 10).toFixed(1)
      : '1.0';
    if (
      !await confirmar(
        `¿Subir versión de "${version || 'N/A'}" a "${nueva}"?\n\nEsto forzará una recarga en TODOS los dispositivos del taller.`,
      )
    )
      return;
    setForzando(true);
    try {
      const v = await forzarActualizacion();
      toast.success(`Versión actualizada a v${v}. Todos los dispositivos se recargarán.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setForzando(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Versión */}
      <div className="rounded-lg border border-destructive/30 bg-card/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Radio className="h-4 w-4 text-destructive" />
          <strong className="text-sm">Control de Versión</strong>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Incrementar la versión mínima fuerza una recarga en todos los dispositivos del
          taller conectados.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="rounded-lg border-2 px-6 py-2.5 font-mono text-2xl font-bold"
            style={{
              backgroundColor: 'rgba(10,61,98,0.5)',
              color: '#00d2ff',
              borderColor: 'rgba(0,210,255,0.3)',
            }}
          >
            {loading ? '…' : `v${version || '—'}`}
          </div>
          <div>
            <div className="mb-1 text-xs text-muted-foreground">Versión activa en Supabase</div>
            <Button
              onClick={forzar}
              disabled={forzando || loading}
              className="gap-1.5 bg-destructive hover:bg-destructive"
            >
              {forzando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Radio className="h-3.5 w-3.5" />
              Forzar actualización en taller
            </Button>
          </div>
        </div>
      </div>

      {/* Estado del sistema */}
      <div className="rounded-lg border border-blue-500/30 bg-card/40 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent" />
          <strong className="text-sm">Estado del Sistema</strong>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="OTs en Supabase" val={String(ots.length)} color="#3b82f6" />
          <StatCard label="Telas en Stock" val={String(telas.length)} color="#14b8a6" />
          <StatCard label="Última actividad" val={ultima} color="#f59e0b" />
          <StatCard
            label="Supabase"
            val={online ? '🟢 Online' : '🔴 Offline'}
            color={online ? '#22c55e' : '#ef4444'}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  val,
  color,
}: {
  label: string;
  val: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-background/50 p-3 text-center">
      <div className="text-lg font-bold" style={{ color }}>
        {val}
      </div>
      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">{label}</div>
    </div>
  );
}
