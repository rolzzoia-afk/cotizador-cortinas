// Tab Catálogo: stats arriba + filtros + tabla ordenable. Click en una fila
// abre TelaDialog; click en el QR abre QRTelaDialog.

import { useMemo, useState } from 'react';
import { Pencil, Plus, QrCode, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatCard from '../components/StatCard';
import TelaDialog from '../dialogs/TelaDialog';
import QRTelaDialog from '../dialogs/QRTelaDialog';
import { tipoBadgeCls } from '../utils/tipo-badge';
import type { Colmena, SortDir, Tela, ValidadoresMap } from '../Telas.types';

interface CatalogoTabProps {
  telas: Tela[];
  validadores: ValidadoresMap;
  empresaId: string;
  onReload: () => void;
  colmena: Colmena;
}

export default function CatalogoTab({
  telas,
  validadores,
  empresaId,
  onReload,
  colmena,
}: CatalogoTabProps) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [sortCol, setSortCol] = useState<keyof Tela>('codigo');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalTela, setModalTela] = useState<Tela | null | undefined>(undefined);
  const [modalQR, setModalQR] = useState<Tela | null>(null);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filt = telas.filter((t) => {
      const matchQ =
        !q ||
        [
          t.codigo,
          t.nemotecnico,
          t.proveedor,
          t.grupo,
          t.posicion,
          t.proveedor_codigo,
          t.cod_ext,
          t.descriptor,
        ].some((v) => (v || '').toString().toLowerCase().includes(q));
      const matchTipo = !filtroTipo || t.tipo === filtroTipo;
      const matchGrupo = !filtroGrupo || t.grupo === filtroGrupo;
      const matchEst = !filtroEstado || t.estado === filtroEstado || t.almacen === filtroEstado;
      return matchQ && matchTipo && matchGrupo && matchEst;
    });
    filt.sort((a, b) => {
      const va = String(a[sortCol] ?? '').toLowerCase();
      const vb = String(b[sortCol] ?? '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return filt;
  }, [telas, busqueda, filtroTipo, filtroGrupo, filtroEstado, sortCol, sortDir]);

  const stats = useMemo(
    () => ({
      total: telas.length,
      bk: telas.filter((t) => t.tipo === 'BK').length,
      du: telas.filter((t) => t.tipo === 'DU').length,
      sc: telas.filter((t) => t.tipo === 'SC').length,
      liberado: telas.filter((t) => t.almacen === 'LIBERADO').length,
      mp: telas.filter((t) => t.almacen === 'MATERIAS PRIMAS').length,
    }),
    [telas],
  );

  const sort = (col: keyof Tela) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] p-4">
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <StatCard label="Total Telas" value={stats.total} />
        <StatCard label="Blackout" value={stats.bk} color="#6366f1" />
        <StatCard label="Duo" value={stats.du} color="#a855f7" />
        <StatCard label="Screen" value={stats.sc} color="#3b82f6" />
        <StatCard label="Liberado" value={stats.liberado} color="#22c55e" />
        <StatCard label="MP" value={stats.mp} color="#f59e0b" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, nemotécnico, proveedor…"
            className="border-border bg-card pl-8"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="BK">Blackout</option>
          <option value="DU">Duo</option>
          <option value="SC">Screen</option>
        </select>
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los grupos</option>
          {(validadores.GRUPO || []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-md border border-border bg-card px-2 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="DESCONTINUADO">Descontinuado</option>
          <option value="LIBERADO">Liberado</option>
          <option value="MATERIAS PRIMAS">Mat. Primas</option>
        </select>
        <Button onClick={() => setModalTela(null)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nueva Tela
        </Button>
      </div>

      <div className="overflow-auto rounded-2xl border border-border bg-card">
        <table className="w-full border-collapse text-[12px]" style={{ minWidth: 1400 }}>
          <thead>
            <tr className="border-b border-border bg-white/[0.03] text-[12px] uppercase tracking-wider text-muted-foreground">
              {[
                ['codigo', 'Código'],
                ['tipo', 'Tipo'],
                ['grupo', 'Grupo'],
                ['nemotecnico', 'Nemotécnico'],
                ['proveedor', 'Proveedor'],
                ['cod_ext', 'Cód. Ext'],
                ['descriptor', 'Descriptor'],
                ['ancho', 'Ancho'],
                ['stock_total', 'Total'],
                ['stock_mp', 'MP'],
                ['stock_liberado', 'Liberado'],
                ['posicion', 'Posición'],
                ['almacen', 'Almacén'],
                ['estado', 'Estado'],
              ].map(([k, l]) => (
                <th
                  key={k}
                  onClick={() => sort(k as keyof Tela)}
                  className="cursor-pointer whitespace-nowrap px-2.5 py-2 text-left font-bold hover:text-foreground"
                >
                  {l}
                </th>
              ))}
              <th className="px-2.5 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            ) : (
              lista.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-secondary/40">
                  <td className="whitespace-nowrap px-2.5 py-2 font-bold">{t.codigo || '—'}</td>
                  <td className="px-2.5 py-2">
                    {t.tipo ? (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[12px] font-bold',
                          tipoBadgeCls(t.tipo),
                        )}
                      >
                        {t.tipo}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-2.5 py-2 text-muted-foreground">{t.grupo || '—'}</td>
                  <td className="px-2.5 py-2">{t.nemotecnico || '—'}</td>
                  <td className="px-2.5 py-2 text-muted-foreground">{t.proveedor || '—'}</td>
                  <td className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    {t.cod_ext || '—'}
                  </td>
                  <td
                    className="max-w-[140px] truncate px-2.5 py-2 text-muted-foreground"
                    title={t.descriptor || ''}
                  >
                    {t.descriptor || '—'}
                  </td>
                  <td className="px-2.5 py-2 text-center">{t.ancho ?? '—'}</td>
                  <td className="px-2.5 py-2 text-center font-semibold">{t.stock_total ?? '—'}</td>
                  <td className="px-2.5 py-2 text-center text-muted-foreground">{t.stock_mp ?? '—'}</td>
                  <td className="px-2.5 py-2 text-center text-muted-foreground">
                    {t.stock_liberado ?? '—'}
                  </td>
                  <td className="px-2.5 py-2">
                    <code className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] text-accent">
                      {t.posicion || '—'}
                    </code>
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[12px] text-foreground">
                      {t.almacen === 'LIBERADO'
                        ? 'Liberado'
                        : t.almacen === 'MATERIAS PRIMAS'
                          ? 'MP'
                          : '—'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-center text-[11px] text-muted-foreground">
                    {t.estado || '—'}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-center">
                    <button
                      onClick={() => setModalTela(t)}
                      className="mr-1 rounded-md border border-border bg-secondary p-1.5 hover:border-accent/40 hover:bg-accent/10"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setModalQR(t)}
                      className="rounded-md border border-purple-500/30 bg-accent/10 p-1.5 text-accent hover:bg-accent/20"
                      title="QR"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Mostrando {lista.length} de {telas.length} telas
      </div>

      {modalTela !== undefined && (
        <TelaDialog
          tela={modalTela}
          validadores={validadores}
          empresaId={empresaId}
          onClose={() => setModalTela(undefined)}
          onSaved={() => {
            setModalTela(undefined);
            onReload();
          }}
        />
      )}

      {modalQR && <QRTelaDialog tela={modalQR} colmena={colmena} onClose={() => setModalQR(null)} />}
    </div>
  );
}
