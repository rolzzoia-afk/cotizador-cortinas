import { useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { ODIOS_ESTADOS } from '@/modules/admin/constants';
import type { OT } from '@/modules/ots/types';
import type { Tela } from '@/modules/admin/types';

type Props = {
  ots: OT[];
  telas: Tela[];
};

const PERIODOS = [
  { value: '30', label: 'Últimos 30 días' },
  { value: '60', label: 'Últimos 60 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '365', label: 'Último año' },
  { value: '0', label: 'Todo el historial' },
];

export function Reportes({ ots, telas }: Props) {
  const [periodo, setPeriodo] = useState('30');

  const filtro = useMemo(() => {
    const dias = parseInt(periodo);
    if (dias === 0) return ots;
    const ahora = Date.now();
    return ots.filter((o) => {
      const t = new Date(o.fechaCreacion || o.fechaModificacion || 0).getTime();
      return ahora - t <= dias * 86400000;
    });
  }, [ots, periodo]);

  const kpis = useMemo(() => {
    const totalM2 = filtro.reduce((acc, o) => {
      return (
        acc +
        (o.storeVentanas || []).reduce((s, v) => {
          const ancho = parseFloat(String(v.ancho ?? 0)) / 100;
          const alto = parseFloat(String(v.alto ?? 0)) / 100;
          return s + ancho * alto;
        }, 0)
      );
    }, 0);
    const clientes = new Set(
      filtro
        .map((o) => (o.datosGenerales?.cliente || '').trim().toLowerCase())
        .filter(Boolean),
    ).size;
    const ventanas = filtro.reduce((s, o) => s + (o.storeVentanas || []).length, 0);
    return { totalOTs: filtro.length, clientes, ventanas, totalM2 };
  }, [filtro]);

  const porMes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of filtro) {
      const d = new Date(o.fechaCreacion || o.fechaModificacion || 0);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtro]);

  const maxMes = Math.max(...porMes.map((x) => x[1]), 1);

  const porEstado = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of filtro) {
      const k = o.estado || '—';
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtro]);

  const maxEstado = Math.max(...porEstado.map((x) => x[1]), 1);

  const topClientes = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of filtro) {
      const c = (o.datosGenerales?.cliente || 'Sin nombre').trim();
      m[c] = (m[c] || 0) + 1;
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [filtro]);

  const maxCliente = Math.max(...topClientes.map((x) => x[1]), 1);

  const exportarExcel = () => {
    try {
      const filas: (string | number)[][] = [
        ['OT #', 'Cliente', 'Estado', 'Ventanas', 'Creada', 'Modificada', 'Nota admin'],
      ];
      const sortedOTs = [...ots].sort((a, b) =>
        (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''),
      );
      for (const o of sortedOTs) {
        const dg = o.datosGenerales || {};
        filas.push([
          dg.ot || '—',
          dg.cliente || '—',
          ODIOS_ESTADOS[o.estado]?.label || o.estado || '—',
          (o.storeVentanas || []).length,
          (o.fechaCreacion || '').slice(0, 10) || '—',
          (o.fechaModificacion || '').slice(0, 10) || '—',
          o.notas || '',
        ]);
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'OTs');

      if (telas.length) {
        const filasStock: (string | number)[][] = [
          ['Código', 'Nombre', 'Ancho rollo (m)', 'M disponibles', 'Alerta mínimo', 'Actualizado'],
        ];
        for (const t of telas) {
          filasStock.push([
            t.codigo || '',
            t.nombre || '',
            t.ancho_m || '',
            t.metros_disponibles || 0,
            t.alerta_minimo || 10,
            (t.fechaActualizacion || '').slice(0, 10),
          ]);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasStock), 'Stock Telas');
      }

      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_OdD_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Reporte exportado a Excel');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al exportar: ' + msg);
    }
  };

  return (
    <div className="rounded-lg border border-accent/30 bg-card/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" />
          <strong className="text-sm">Estadísticas de Producción</strong>
        </div>
        <div className="flex gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="h-8 rounded border border-border bg-card px-2 text-xs text-foreground"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={exportarExcel}
            className="h-8 gap-1 border-success/30 text-success hover:bg-success/15"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* KPIs del período */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiMini label="OTs en período" val={kpis.totalOTs} color="#3b82f6" />
        <KpiMini label="Clientes únicos" val={kpis.clientes} color="#a855f7" />
        <KpiMini label="Ventanas totales" val={kpis.ventanas} color="#f59e0b" />
        <KpiMini label="M² aprox." val={`${kpis.totalM2.toFixed(1)} m²`} color="#22c55e" />
      </div>

      {/* OTs por mes */}
      <div className="mb-4">
        <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
          OTs por mes
        </div>
        {porMes.length === 0 ? (
          <span className="text-xs text-muted-foreground">Sin datos en el período</span>
        ) : (
          <div className="space-y-1">
            {porMes.map(([m, n]) => {
              const pct = Math.round((n / maxMes) * 100);
              const [yr, mo] = m.split('-');
              const label = new Date(parseInt(yr), parseInt(mo) - 1, 1).toLocaleString('es-CL', {
                month: 'short',
                year: '2-digit',
              });
              return (
                <div key={m} className="flex items-center gap-2 text-xs">
                  <span className="min-w-[60px] text-[0.68rem] text-muted-foreground">{label}</span>
                  <div className="h-4 flex-1 overflow-hidden rounded bg-card">
                    <div
                      className="h-full rounded transition-all"
                      style={{ width: `${pct}%`, backgroundColor: '#6366f1', opacity: 0.75 }}
                    />
                  </div>
                  <span className="min-w-[24px] text-xs font-bold text-accent">{n}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Distribución + Top clientes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Distribución por estado
          </div>
          {porEstado.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          ) : (
            <div className="space-y-1">
              {porEstado.map(([k, n]) => {
                const cfg = ODIOS_ESTADOS[k] || { label: k, color: '#94a3b8', bg: '' };
                const pct = Math.round((n / maxEstado) * 100);
                return (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span
                      className="min-w-[80px] font-semibold"
                      style={{ color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded bg-card">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cfg.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold"
                      style={{ color: cfg.color }}
                    >
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Top clientes (por OTs)
          </div>
          {topClientes.length === 0 ? (
            <span className="text-xs text-muted-foreground">Sin datos</span>
          ) : (
            <div className="space-y-1">
              {topClientes.map(([nom, n]) => {
                const pct = Math.round((n / maxCliente) * 100);
                return (
                  <div key={nom} className="flex items-center gap-2 text-xs">
                    <span
                      className="min-w-[100px] truncate text-[0.68rem]"
                      title={nom}
                    >
                      {nom}
                    </span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded bg-card">
                      <div
                        className="h-full rounded"
                        style={{ width: `${pct}%`, backgroundColor: '#14b8a6', opacity: 0.7 }}
                      />
                    </div>
                    <span className="text-xs font-bold text-teal-400">{n}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiMini({ label, val, color }: { label: string; val: number | string; color: string }) {
  return (
    <div
      className="rounded-lg border bg-card/40 p-2 text-center"
      style={{ borderColor: color + '33' }}
    >
      <div className="text-lg font-extrabold" style={{ color }}>
        {val}
      </div>
      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">{label}</div>
    </div>
  );
}
