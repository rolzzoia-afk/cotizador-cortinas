// La ficha de una tela: la misma lámina 4 que la del insumo, pero la tela se
// lleva en METROS y tiene dos vidas — el rollo del catálogo y los paños ya
// cortados que esperan en la colmena. Las dos se muestran juntas porque para
// el taller son el mismo material.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatBox } from '@/components/ui/stat-box';
import { TabButton } from '@/components/ui/tab-button';
import ConsumoMeses from '@/components/inventario/ConsumoMeses';
import TablaMovimientos from '@/components/inventario/TablaMovimientos';
import { badgeEstadoArticulo } from '@/modules/inventario/badges';
import {
  coberturaMeses,
  consumoUltimosMeses,
  faltanParaMinimo,
  promedioMensual,
  resumenPanos,
} from '@/modules/inventario/ficha';
import { useFichaTela } from '@/modules/inventario/fichaTelaStore';
import { armarColmena } from '@/modules/inventario/telasStore';
import { Dato } from '../insumos/ficha/PanelesFicha';
import QRTelaDialog from './dialogs/QRTelaDialog';
import { useInventario } from '../InventarioLayout';

type TabFicha = 'resumen' | 'kardex' | 'panos' | 'fallas' | 'ubicaciones';

const metros = (n: number) => `${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })} m`;

export function FichaTela() {
  const { codigo: crudo = '' } = useParams();
  const codigo = decodeURIComponent(crudo);
  const { queryRol } = useInventario();
  const { tela, movimientos, slots, fallas, mermas, panos, loading, error } = useFichaTela(codigo);

  const [tab, setTab] = useState<TabFicha>('resumen');
  const [qrAbierto, setQrAbierto] = useState(false);

  const consumo = useMemo(() => consumoUltimosMeses(movimientos), [movimientos]);
  const promedio = useMemo(() => promedioMensual(consumo), [consumo]);
  const retazos = useMemo(() => resumenPanos(panos), [panos]);

  const volver = `/inventario/telas${queryRol}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-8 w-56 animate-pulse rounded bg-muted/60" />
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !tela) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={volver} className="flex items-center gap-1.5 text-xs text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Telas
        </Link>
        <EmptyState
          titulo={error ? 'No se pudo abrir la ficha' : `No existe la tela ${codigo}`}
          texto={error || 'Puede que el código esté escrito distinto o sea de otra empresa.'}
        />
      </div>
    );
  }

  const mp = tela.stock_mp || 0;
  const liberado = tela.stock_liberado || 0;
  const total = mp + liberado;
  const faltan = faltanParaMinimo(total, tela.stock_minimo);
  const estado = badgeEstadoArticulo({ total, minimo: tela.stock_minimo, status: tela.status_stock });
  const cobertura = coberturaMeses(total, promedio);
  const fallasAbiertas = fallas.filter((f) => f.resuelto === 'NO').length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link to={`/inventario${queryRol}`} className="hover:text-accent hover:underline">
              Inventario
            </Link>
            {' · '}
            <Link to={volver} className="hover:text-accent hover:underline">
              Telas
            </Link>
            {' · '}
            <span className="text-foreground">{tela.codigo}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-mono text-[1.6rem] font-semibold leading-tight tracking-tight">
              {tela.codigo}
            </h1>
            <span className="font-serif text-[1.6rem] font-medium leading-tight tracking-[-0.02em]">
              {tela.nemotecnico || tela.descriptor || ''}
            </span>
            <Badge variant={estado.variante}>{estado.texto}</Badge>
            {tela.tipo ? (
              <Badge variant="muted">
                {tela.tipo}
                {tela.grupo ? ` · ${tela.grupo}` : ''}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrAbierto(true)}>
            <Printer className="h-4 w-4" /> QR y etiqueta
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link to={`/inventario/colmena${queryRol}`}>
              Ver en la colmena <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          rotulo="Materias primas"
          valor={metros(mp)}
          compacto
          hint={tela.posicion ? `posición ${tela.posicion}` : 'sin posición'}
        />
        <StatBox
          rotulo="Liberado"
          valor={metros(liberado)}
          compacto
          hint="se corta primero de acá"
        />
        <StatBox
          rotulo="Paños en colmena"
          valor={retazos.disponibles.toLocaleString('es-CL')}
          hint={`${retazos.m2.toLocaleString('es-CL')} m² · ${retazos.usados.toLocaleString('es-CL')} ya usados`}
        />
        <StatBox
          rotulo="Total en metros"
          valor={metros(total)}
          compacto
          tono={estado.variante === 'destructive' ? 'destructive' : estado.variante === 'warning' ? 'warning' : 'accent'}
          hint={
            faltan == null
              ? 'sin mínimo definido'
              : faltan > 0
                ? `mínimo ${tela.stock_minimo} · faltan ${faltan.toLocaleString('es-CL')}`
                : `mínimo ${tela.stock_minimo} · cubierto`
          }
        />
      </div>

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton variante="subrayado" active={tab === 'resumen'} onClick={() => setTab('resumen')}>
          Resumen
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'kardex'}
          onClick={() => setTab('kardex')}
          badge={
            movimientos.length > 0 ? (
              <Badge variant="muted">{movimientos.length.toLocaleString('es-CL')}</Badge>
            ) : null
          }
        >
          Kardex
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'panos'}
          onClick={() => setTab('panos')}
          badge={
            retazos.disponibles > 0 ? (
              <Badge variant="muted">{retazos.disponibles.toLocaleString('es-CL')}</Badge>
            ) : null
          }
        >
          Paños
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'fallas'}
          onClick={() => setTab('fallas')}
          badge={
            fallasAbiertas > 0 ? <Badge variant="destructive">{fallasAbiertas}</Badge> : null
          }
        >
          Fallas y mermas
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'ubicaciones'}
          onClick={() => setTab('ubicaciones')}
        >
          Ubicaciones
        </TabButton>
      </div>

      {tab === 'resumen' ? (
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5">
            <div className="flex h-[190px] items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
              {tela.foto_url ? (
                <img
                  src={tela.foto_url}
                  alt={`${tela.codigo} ${tela.nemotecnico || ''}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sin foto</span>
              )}
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Ficha
              </h2>
              <div className="mt-1.5 flex flex-col">
                <Dato rotulo="Tipo" valor={tela.tipo || '—'} />
                <Dato rotulo="Grupo" valor={tela.grupo || '—'} />
                <Dato rotulo="Calidad" valor={tela.calidad || '—'} />
                <Dato
                  rotulo="Ancho del rollo"
                  valor={
                    tela.ancho ? (
                      <span className="font-mono">{tela.ancho} m</span>
                    ) : (
                      <span className="text-warning">sin registrar</span>
                    )
                  }
                />
                <Dato rotulo="Proveedor" valor={tela.proveedor || '—'} />
                <Dato rotulo="Cód. proveedor" valor={tela.proveedor_codigo || tela.cod_ext || '—'} />
                <Dato
                  rotulo="Mínimo"
                  valor={
                    (tela.stock_minimo || 0) > 0 ? (
                      <span className="font-mono">{tela.stock_minimo} m</span>
                    ) : (
                      <span className="text-muted-foreground">sin definir</span>
                    )
                  }
                />
                {tela.observaciones ? (
                  <Dato rotulo="Observaciones" valor={tela.observaciones} />
                ) : null}
              </div>
              {!tela.ancho ? (
                <p className="mt-2 text-[0.6875rem] text-warning">
                  Sin ancho de rollo el sistema asume 2,98 m al calcular los paños.
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3.5">
            <ConsumoMeses consumo={consumo} promedio={promedio} cobertura={cobertura} />
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <h2 className="font-serif text-[0.9375rem] font-medium">Últimos movimientos</h2>
                {movimientos.length > 5 ? (
                  <button
                    type="button"
                    onClick={() => setTab('kardex')}
                    className="ml-auto text-xs text-accent hover:underline"
                  >
                    Ver los {movimientos.length} →
                  </button>
                ) : null}
              </div>
              {movimientos.length === 0 ? (
                <div className="px-4 pb-4">
                  <EmptyState
                    titulo="Sin movimientos registrados"
                    texto="Los metros que entran y salen de esta tela van a aparecer acá."
                  />
                </div>
              ) : (
                <TablaMovimientos filas={movimientos.slice(0, 5)} unidad="m" />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'kardex' ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {movimientos.length === 0 ? (
            <div className="p-4">
              <EmptyState titulo="Sin movimientos registrados" />
            </div>
          ) : (
            <>
              <TablaMovimientos filas={movimientos} unidad="m" />
              <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                {movimientos.length.toLocaleString('es-CL')} movimientos · hoy un movimiento de tela
                no mueve el saldo; con el kardex de la próxima entrega sí.
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'panos' ? (
        panos.length === 0 ? (
          <EmptyState
            titulo="Sin paños de esta tela en la colmena"
            texto="Los retazos aprovechables aparecen acá cuando el optimizador los guarda."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem] tabular-nums">
                <thead>
                  <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="h-9 px-3 text-left font-medium">Medida</th>
                    <th className="h-9 px-3 text-right font-medium">m²</th>
                    <th className="h-9 px-3 text-left font-medium">Ubicación</th>
                    <th className="h-9 px-3 text-left font-medium">Estado</th>
                    <th className="h-9 px-3 text-left font-medium">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {panos
                    .filter((p) => !p.datos_extra?.baja)
                    .map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono">
                          {p.medida_ancho ?? '—'} × {p.medida_alto ?? '—'} cm
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {(
                            ((p.medida_ancho || 0) * (p.medida_alto || 0)) /
                            10000
                          ).toLocaleString('es-CL', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.ubicacion || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={p.disponible ? 'success' : 'muted'}>
                            {p.disponible ? 'Disponible' : 'Usado'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-accent">{p.ot_asignada || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      {tab === 'fallas' ? (
        <div className="flex flex-col gap-3.5">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="px-4 py-3">
              <h2 className="font-serif text-[0.9375rem] font-medium">Fallas reportadas</h2>
            </div>
            {fallas.length === 0 ? (
              <div className="px-4 pb-4">
                <EmptyState titulo="Sin fallas reportadas para esta tela" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[0.8125rem] tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="h-9 px-3 text-left font-medium">Fecha</th>
                      <th className="h-9 px-3 text-left font-medium">Falla</th>
                      <th className="h-9 px-3 text-right font-medium">Metraje</th>
                      <th className="h-9 px-3 text-left font-medium">Quién</th>
                      <th className="h-9 px-3 text-left font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fallas.map((f) => (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                          {f.fecha_reporte || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {f.tipo_falla || '—'}
                          {f.observaciones ? (
                            <span className="text-muted-foreground"> · {f.observaciones}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{f.metraje ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{f.responsable || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={f.resuelto === 'SI' ? 'success' : 'destructive'}>
                            {f.resuelto === 'SI' ? 'Resuelta' : 'Abierta'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="px-4 py-3">
              <h2 className="font-serif text-[0.9375rem] font-medium">Mermas</h2>
            </div>
            {mermas.length === 0 ? (
              <div className="px-4 pb-4">
                <EmptyState titulo="Sin mermas de esta tela" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[0.8125rem] tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="h-9 px-3 text-left font-medium">Fecha</th>
                      <th className="h-9 px-3 text-left font-medium">Medida</th>
                      <th className="h-9 px-3 text-left font-medium">Motivo</th>
                      <th className="h-9 px-3 text-left font-medium">OT de origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mermas.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-muted-foreground">
                          {(m.fecha || m.created_at || '').slice(0, 10) || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {m.medida_ancho ?? '—'} × {m.medida_alto ?? '—'} cm
                        </td>
                        <td className="px-3 py-2">{m.motivo || '—'}</td>
                        <td className="px-3 py-2 font-mono text-accent">{m.ot_origen || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'ubicaciones' ? (
        slots.length === 0 && !tela.posicion ? (
          <EmptyState
            titulo="Sin posición asignada"
            texto="Esta tela no tiene ninguna posición tomada en la colmena de rollos."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-b border-border text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="h-9 px-3 text-left font-medium">Posición</th>
                  <th className="h-9 px-3 text-left font-medium">Almacén</th>
                  <th className="h-9 px-3 text-left font-medium">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((s) => (
                  <tr key={s.posicion} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono font-medium">{s.posicion}</td>
                    <td className="px-3 py-2">{s.almacen || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">colmena de rollos</td>
                  </tr>
                ))}
                {slots.length === 0 && tela.posicion ? (
                  <tr>
                    <td className="px-3 py-2 font-mono font-medium">{tela.posicion}</td>
                    <td className="px-3 py-2">{tela.almacen || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">ficha del catálogo</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {qrAbierto ? (
        <QRTelaDialog
          tela={tela}
          colmena={armarColmena([tela], slots)}
          onClose={() => setQrAbierto(false)}
        />
      ) : null}
    </div>
  );
}

export default FichaTela;
