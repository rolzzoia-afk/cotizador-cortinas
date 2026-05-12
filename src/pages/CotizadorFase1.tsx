import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOT } from '@/modules/ots/hooks';
import { useCatalogoProductos } from '@/modules/cotizador/catalogo';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Lead } from '@/modules/leads/types';
import {
  CATEGORIAS_FASE1,
  catBadgeColor,
} from '@/modules/cotizador/categorias';
import {
  buscarProducto,
  calcularEstimadoFase1,
  esPorUnidad,
  formatCLP,
  itemToVentana,
} from '@/modules/cotizador/calculos';
import type { ItemFase1, Producto } from '@/modules/cotizador/types';

const EMPTY_FORM = {
  codInt: '',
  ubicacion: '',
  categoria: '',
  color: '',
  cantidad: '1',
  ancho: '',
  alto: '',
};
type Form = typeof EMPTY_FORM;

export function CotizadorFase1() {
  const { id: otId } = useParams();
  const navigate = useNavigate();
  const { empresaId } = useAuth();
  const { ot, loading: loadingOT, guardar } = useOT(otId);
  const { catalogo, loading: loadingCat } = useCatalogoProductos();

  const [form, setForm] = useState<Form>({ ...EMPTY_FORM });
  const [items, setItems] = useState<ItemFase1[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [leadVinculado, setLeadVinculado] = useState<Lead | null>(null);
  const [creandoLead, setCreandoLead] = useState(false);

  // Busca si la OT actual ya está vinculada a un lead
  useEffect(() => {
    if (!otId || !empresaId) {
      setLeadVinculado(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('leads' as any)
        .select('*')
        .eq('ot_id', otId)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      setLeadVinculado((data as unknown as Lead) ?? null);
    })();
  }, [otId, empresaId]);

  const handleGuardarComoLead = async () => {
    if (!ot || !empresaId) return;
    const dg = ot.datosGenerales || {};
    if (!(dg.cliente || '').trim()) {
      toast.error('La OT no tiene cliente cargado — agregalo primero en Datos Generales');
      return;
    }
    setCreandoLead(true);
    try {
      const { data, error: err } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('leads' as any)
        .insert({
          empresa_id: empresaId,
          nombre: dg.cliente,
          whatsapp_phone: dg.telefono || null,
          email: dg.mail || null,
          rut: dg.rut || null,
          fuente: dg.canal || 'manual',
          comuna: dg.comuna || null,
          estado: 'cotizando',
          ot_id: ot.id,
        })
        .select('*')
        .single();
      if (err) throw new Error(err.message);
      const nuevo = data as unknown as Lead;
      await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('leads_actividad' as any)
        .insert({
          lead_id: nuevo.id,
          empresa_id: empresaId,
          tipo: 'creado',
          detalle: { desde: 'cotizador_fase1', ot_id: ot.id },
        });
      setLeadVinculado(nuevo);
      toast.success('Cliente guardado como lead');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al guardar como lead: ' + msg);
    } finally {
      setCreandoLead(false);
    }
  };

  const producto: Producto | undefined = useMemo(
    () => buscarProducto(catalogo, form.codInt),
    [catalogo, form.codInt],
  );

  const estimado = useMemo(() => {
    if (!producto) return null;
    const ancho = parseFloat(form.ancho) || 0;
    const alto = parseFloat(form.alto) || 0;
    const cantidad = parseInt(form.cantidad, 10) || 1;
    if (ancho <= 0 || alto <= 0) return null;
    return calcularEstimadoFase1({
      tipo: producto.tipo,
      ancho,
      alto,
      cantidad,
      precio: producto.precio,
    });
  }, [producto, form.ancho, form.alto, form.cantidad]);

  const totalAcumulado = useMemo(() => {
    return items.reduce((acc, it) => {
      const est = calcularEstimadoFase1({
        tipo: it.tipo,
        ancho: it.ancho,
        alto: it.alto,
        cantidad: it.cantidad,
        precio: it.precio,
      });
      return acc + est.total;
    }, 0);
  }, [items]);

  const actualizarForm = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const agregar = () => {
    if (!producto) {
      toast.error('Código no encontrado en el catálogo');
      return;
    }
    if (!form.ubicacion.trim()) {
      toast.error('Ingresá la ubicación');
      return;
    }
    if (!form.categoria) {
      toast.error('Seleccioná una categoría');
      return;
    }
    const ancho = parseFloat(form.ancho) || 0;
    const alto = parseFloat(form.alto) || 0;
    const cantidad = parseInt(form.cantidad, 10) || 1;
    if (!esPorUnidad(producto.tipo) && (ancho <= 0 || alto <= 0)) {
      toast.error('Ingresá medidas válidas');
      return;
    }
    const nuevo: ItemFase1 = {
      id: crypto.randomUUID(),
      codInt: form.codInt.trim(),
      producto: producto.producto,
      tipo: producto.tipo,
      ubicacion: form.ubicacion.trim(),
      categoria: form.categoria,
      color: form.color.trim() || 'Blanco',
      cantidad,
      ancho,
      alto,
      precio: producto.precio,
    };
    setItems((arr) => [...arr, nuevo]);
    // Reset solo los campos del item, mantener ubicación por si agrega más en el mismo lugar
    setForm((f) => ({
      ...EMPTY_FORM,
      ubicacion: f.ubicacion,
    }));
  };

  const eliminar = (id: string) => {
    setItems((arr) => arr.filter((i) => i.id !== id));
  };

  const enviarATerreno = async () => {
    if (!ot) return;
    if (items.length === 0) {
      toast.error('Agregá al menos 1 producto antes de enviar');
      return;
    }
    setEnviando(true);
    try {
      const nuevasVentanas = items.map(itemToVentana);
      const storeVentanas = [...(ot.storeVentanas || []), ...nuevasVentanas];
      const dg = {
        ...(ot.datosGenerales || {}),
        cotizacionCount: (ot.cotizacionCount || 0) + items.length,
        historialEstados: [
          ...(ot.datosGenerales?.historialEstados || []),
          { de: ot.estado, a: 'terreno' as const, fecha: new Date().toISOString() },
        ],
      };
      await guardar({
        estado: 'terreno',
        storeVentanas,
        datosGenerales: dg,
        cotizacionCount: (ot.cotizacionCount || 0) + items.length,
      });
      toast.success(`${items.length} ítem(s) enviados a Terreno`);
      navigate(`/ots/${ot.id}/fase2`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error al enviar: ' + msg);
    } finally {
      setEnviando(false);
    }
  };

  if (loadingOT || loadingCat) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando cotizador…
      </div>
    );
  }

  if (!ot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>OT no encontrada.</p>
        <Link to="/panel" className="text-sm text-accent hover:underline">
          Volver al Panel
        </Link>
      </div>
    );
  }

  const productosLista = Object.values(catalogo);
  const sinCatalogo = productosLista.length === 0;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/panel')}
            className="rounded p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
            title="Volver al Panel"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-semibold">Fase 1 — Cotización inicial</h2>
            <p className="text-xs text-muted-foreground">
              OT {ot.datosGenerales.ot || '—'} · {ot.datosGenerales.cliente || '(sin cliente)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {leadVinculado ? (
            <button
              onClick={() => navigate(`/leads?abrir=${leadVinculado.id}`)}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
              title="Ver lead vinculado"
            >
              <ExternalLink className="h-3 w-3" /> Lead: {leadVinculado.nombre}
            </button>
          ) : ot.datosGenerales.cliente ? (
            <Button
              onClick={handleGuardarComoLead}
              variant="outline"
              size="sm"
              disabled={creandoLead}
              className="gap-1.5"
            >
              {creandoLead ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              Guardar como lead
            </Button>
          ) : null}
          {ot.storeVentanas.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {ot.storeVentanas.length} ventana(s) ya en la OT
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        {sinCatalogo && (
          <div className="mb-4 rounded-lg border border-warning/30 bg-warning/15 p-3 text-xs text-warning">
            El catálogo de productos está vacío. Importalo desde el cotizador legacy antes de
            cotizar nuevos ítems.
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
          {/* Formulario */}
          <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
            <h3 className="text-sm font-semibold">Agregar producto</h3>

            <div>
              <Label>Código (COD_INT)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={form.codInt}
                  onChange={(e) => actualizarForm({ codInt: e.target.value.trim() })}
                  placeholder="Ej: 1234"
                  list="fase1-codigos-catalogo"
                  className="pl-8 font-mono"
                  autoComplete="off"
                />
              </div>
              <datalist id="fase1-codigos-catalogo">
                {productosLista.slice(0, 500).map((p) => (
                  <option key={p.cod + p.producto} value={p.cod}>
                    {p.producto}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Info del producto */}
            <div
              className={cn(
                'rounded-md border p-2.5 text-xs',
                producto
                  ? 'border-success/30 bg-success/15'
                  : 'border-border bg-card/60 text-muted-foreground',
              )}
            >
              {producto ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[0.7rem] text-muted-foreground">{producto.cod}</span>
                    <span className="rounded bg-card px-1.5 py-0.5 text-[0.62rem] font-semibold text-foreground">
                      {producto.tipo}
                    </span>
                  </div>
                  <div className="font-medium text-foreground">{producto.producto}</div>
                  {producto.descripcion && (
                    <div className="text-muted-foreground">{producto.descripcion}</div>
                  )}
                  <div className="text-success">
                    {formatCLP(producto.precio)}{' '}
                    {esPorUnidad(producto.tipo) ? '/unidad' : '/m²'}
                  </div>
                </div>
              ) : form.codInt ? (
                <span className="text-destructive">Código no encontrado</span>
              ) : (
                <span>Ingresá un código para ver el producto</span>
              )}
            </div>

            <div>
              <Label>Ubicación</Label>
              <Input
                value={form.ubicacion}
                onChange={(e) => actualizarForm({ ubicacion: e.target.value })}
                placeholder="Living, Dormitorio 1, etc."
              />
            </div>

            <div>
              <Label>Categoría</Label>
              <select
                value={form.categoria}
                onChange={(e) => actualizarForm({ categoria: e.target.value })}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">— Seleccioná categoría —</option>
                {CATEGORIAS_FASE1.map((grupo) => (
                  <optgroup key={grupo.label} label={grupo.label}>
                    {grupo.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Color accesorios</Label>
                <Input
                  value={form.color}
                  onChange={(e) => actualizarForm({ color: e.target.value })}
                  placeholder="Blanco"
                />
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.cantidad}
                  onChange={(e) => actualizarForm({ cantidad: e.target.value })}
                />
              </div>
              <div>
                <Label>Ancho (m)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.ancho}
                  onChange={(e) => actualizarForm({ ancho: e.target.value })}
                  placeholder="1.50"
                  disabled={producto && esPorUnidad(producto.tipo)}
                />
              </div>
              <div>
                <Label>Alto (m)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.alto}
                  onChange={(e) => actualizarForm({ alto: e.target.value })}
                  placeholder="2.40"
                  disabled={producto && esPorUnidad(producto.tipo)}
                />
              </div>
            </div>

            {/* Estimado en vivo */}
            {estimado && (
              <div className="rounded-md border border-success/30 bg-success/15 p-2.5 text-xs">
                <div className="flex items-center justify-between text-foreground">
                  <span>
                    <span className="text-muted-foreground">M²:</span>{' '}
                    <strong>{estimado.totalM2.toFixed(2)}</strong>
                    <span className="text-muted-foreground"> × </span>
                    {formatCLP(producto?.precio || 0)}
                  </span>
                  <strong className="text-base text-success">
                    {formatCLP(estimado.total)}
                  </strong>
                </div>
              </div>
            )}

            <Button
              onClick={agregar}
              disabled={!producto || !form.ubicacion || !form.categoria}
              className="w-full gap-1"
            >
              <Plus className="h-4 w-4" /> Agregar a la cotización
            </Button>
          </div>

          {/* Tabla de items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Productos cotizados ({items.length})
              </h3>
              <span className="text-sm text-muted-foreground">
                Total estimado:{' '}
                <strong className="text-base text-success">
                  {formatCLP(totalAcumulado)}
                </strong>
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card/40">
              <table className="w-full text-xs">
                <thead className="bg-card text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Cant</th>
                    <th className="p-2 text-left">Ubicación</th>
                    <th className="p-2 text-left">Categoría</th>
                    <th className="p-2 text-left">Producto</th>
                    <th className="p-2 text-left">Dim</th>
                    <th className="p-2 text-right">M²</th>
                    <th className="p-2 text-right">Subtotal</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">
                        Sin productos cotizados todavía. Agregá desde el formulario.
                      </td>
                    </tr>
                  )}
                  {items.map((it) => {
                    const est = calcularEstimadoFase1({
                      tipo: it.tipo,
                      ancho: it.ancho,
                      alto: it.alto,
                      cantidad: it.cantidad,
                      precio: it.precio,
                    });
                    const badge = catBadgeColor(it.categoria);
                    const anchoCm = (it.ancho * 100).toFixed(0);
                    const altoCm = (it.alto * 100).toFixed(0);
                    return (
                      <tr key={it.id} className="border-t border-border hover:bg-card">
                        <td className="p-2 text-center font-semibold">{it.cantidad}</td>
                        <td className="p-2">{it.ubicacion}</td>
                        <td className="p-2">
                          <span
                            className="rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold"
                            style={{
                              backgroundColor: badge.bg,
                              borderColor: badge.border,
                              color: badge.color,
                            }}
                          >
                            {it.categoria}
                          </span>
                        </td>
                        <td className="p-2">
                          <div>{it.producto}</div>
                          <div className="text-[0.68rem] text-muted-foreground">
                            {it.color} · {it.codInt}
                          </div>
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {esPorUnidad(it.tipo) ? '—' : `${anchoCm}×${altoCm} cm`}
                        </td>
                        <td className="p-2 text-right text-foreground">
                          {est.totalM2.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-semibold text-success">
                          {formatCLP(est.total)}
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={() => eliminar(it.id)}
                            className="rounded border border-destructive/30 bg-destructive/15 p-1 text-destructive hover:bg-destructive/15"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => navigate('/panel')}>
                Guardar y volver al Panel
              </Button>
              <Button
                onClick={enviarATerreno}
                disabled={enviando || items.length === 0}
                className="gap-1"
              >
                {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enviar a Terreno (Fase 2)
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
