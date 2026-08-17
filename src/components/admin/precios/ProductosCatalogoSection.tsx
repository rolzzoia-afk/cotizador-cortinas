// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Catálogo de productos (la hoja "Productos" del Excel)
//
// Todas las telas y accesorios que se pueden vender, con su precio por metro,
// su descuento por defecto y su ancho de rollo. La columna importante es la
// última: con qué RECETA y a qué precio por metro se va a cobrar cada una. Eso
// es lo que uno necesita saber al dar de alta un código nuevo, y hasta ahora
// solo se podía averiguar cotizando.
//
// A diferencia del resto del tab, esta sección NO tiene borrador: los diálogos
// que reusa (nuevo/editar, clonar, importar) guardan solos, igual que en Fase 0.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, History, Pencil, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCLP } from '@/lib/formatters';
import ProductoCatalogoDialog from '@/components/cotizador/ProductoCatalogoDialog';
import ClonarCodigoDialog from '@/pages/telas/dialogs/ClonarCodigoDialog';
import ImportarCatalogoDialog from '@/pages/telas/dialogs/ImportarCatalogoDialog';
import {
  guardarAnchoRollo,
  guardarCatalogoProductos,
  useAnchoRollo,
  useCatalogoProductos,
} from '@/modules/cotizador/catalogo';
import { familiasDelCatalogo } from '@/modules/cotizador/catalogoEdicion';
import {
  cargarRespaldosCatalogo,
  codigosDelRespaldo,
  type RespaldoCatalogo,
} from '@/modules/cotizador/catalogoRespaldos';
import { avisosCatalogo, flujoDeProducto } from '@/modules/cotizador/flujoCatalogo';
import { useReglasPrecios } from '@/modules/cotizador/reglasPreciosStore';

// Cuántas filas se dibujan antes de pedir que se afine la búsqueda. El catálogo
// entero (unos 500 códigos) tiene que caber: acá se viene justamente a revisarlo
// completo, y con 200 parecía que faltaban productos.
const TOPE_FILAS = 1000;

function ChipGama({ cat }: { cat: string | null | undefined }) {
  if (!cat) return null;
  const tono =
    cat === 'B'
      ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400';
  return <span className={`rounded border px-1 text-[10px] font-bold leading-4 ${tono}`}>{cat}</span>;
}

export function ProductosCatalogoSection() {
  const { empresaId } = useAuth();
  const confirmar = useConfirm();
  const { catalogo, loading, refresh: refrescarCatalogo } = useCatalogoProductos();
  const { anchoRollo, refresh: refrescarAncho } = useAnchoRollo();
  // Las reglas GUARDADAS, no el borrador: el catálogo se guarda al instante, así
  // que la columna de flujo tiene que decir con qué se cobra HOY.
  const { reglas } = useReglasPrecios();

  const [filtro, setFiltro] = useState('');
  const [familia, setFamilia] = useState('');
  // null = producto nuevo · string = editar ese código · undefined = cerrado.
  const [editar, setEditar] = useState<string | null | undefined>(undefined);
  const [clonar, setClonar] = useState(false);
  const [importar, setImportar] = useState(false);
  const [respaldos, setRespaldos] = useState<RespaldoCatalogo[]>([]);
  const [verRespaldos, setVerRespaldos] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  const cargarRespaldos = () => {
    if (empresaId) cargarRespaldosCatalogo(empresaId).then(setRespaldos);
  };
  // Se recargan cuando cambia el catálogo: cada guardado deja una foto nueva.
  useEffect(() => {
    cargarRespaldos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, catalogo]);

  const refrescarTodo = () => {
    refrescarCatalogo();
    refrescarAncho();
  };

  const familias = useMemo(() => familiasDelCatalogo(catalogo), [catalogo]);
  const porLamas = reglas.telaVertical.modo === 'lamas';
  const avisos = useMemo(
    () => avisosCatalogo(catalogo, anchoRollo, reglas),
    [catalogo, anchoRollo, reglas],
  );

  const filas = useMemo(() => {
    const f = filtro.trim().toUpperCase();
    return Object.entries(catalogo)
      .filter(([codInt, p]) => {
        if (!p) return false;
        if (familia && (p.cod || '') !== familia) return false;
        if (!f) return true;
        return [codInt, p.cod, p.producto, p.descripcion, p.tipo]
          .map((s) => String(s ?? '').toUpperCase())
          .some((s) => s.includes(f));
      })
      .sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [catalogo, filtro, familia]);

  const restaurar = async (r: RespaldoCatalogo) => {
    if (!empresaId) return;
    const ok = await confirmar({
      titulo: '¿Restaurar este respaldo?',
      mensaje:
        `El catálogo vuelve a como estaba el ${new Date(r.fecha).toLocaleString('es-CL')}, con ` +
        `${codigosDelRespaldo(r)} códigos. Lo que hay ahora (${Object.keys(catalogo).length} códigos) ` +
        'se reemplaza por completo, y queda respaldado antes de hacerlo.',
      confirmLabel: 'Restaurar',
      destructivo: true,
    });
    if (!ok) return;
    setRestaurando(true);
    try {
      await guardarCatalogoProductos(empresaId, r.catalogo, 'antes de restaurar un respaldo');
      await guardarAnchoRollo(empresaId, r.anchoRollo);
      refrescarTodo();
      cargarRespaldos();
      setVerRespaldos(false);
      toast.success('Catálogo restaurado.');
    } catch (e) {
      toast.error('No se pudo restaurar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRestaurando(false);
    }
  };

  return (
    <>
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Catálogo de productos</h2>
          <span className="text-xs text-muted-foreground">({Object.keys(catalogo).length})</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar código, nombre o diseño"
                className="h-8 w-60 pl-7 text-xs"
              />
            </div>
            <select
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
              className="h-8 rounded-md border bg-secondary px-2 text-xs"
            >
              <option value="">Todas las familias</option>
              {familias.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={() => setVerRespaldos(true)} disabled={!respaldos.length}>
              <History className="mr-1 h-3.5 w-3.5" />
              Respaldos ({respaldos.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImportar(true)}>
              <Upload className="mr-1 h-3.5 w-3.5" />
              Importar Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setClonar(true)}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              Clonar código
            </Button>
            <Button size="sm" onClick={() => setEditar(null)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nuevo producto
            </Button>
          </div>
        </header>

        <p className="mb-3 text-xs text-muted-foreground">
          Cada código de venta con su precio por metro. Un producto entra a la cotización como{' '}
          <strong>cortina</strong> (se mide, se optimiza la tela y se cobra por m²) solo si su tipo
          es PREMIUM, DELUX, STANDARD o BASIC; con cualquier otro tipo entra como{' '}
          <strong>adicional</strong> de precio fijo. La última columna dice con qué receta y con qué
          tela de referencia se termina cobrando.
        </p>

        {(avisos.familiasSinReferencia.length > 0 ||
          avisos.referenciasRotas.length > 0 ||
          avisos.familiasCasiIguales.length > 0 ||
          avisos.productosSinTipo.length > 0 ||
          avisos.telasSinAncho.length > 0) && (
          <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Conviene revisar
            </div>
            <ul className="ml-4 list-disc space-y-1">
              {avisos.familiasSinReferencia.map((f) => (
                <li key={f.cod}>
                  La familia <strong>{f.cod}</strong> ({f.telas} telas) no tiene tela de referencia,
                  así que se cobra con la más cara del grupo ({f.telaMasCara}). Si entra una tela
                  cara con esa misma familia, sube el precio de todas. Se declara en «Tela de
                  referencia por familia».
                </li>
              ))}
              {avisos.referenciasRotas.map((r) => (
                <li key={r.cod}>
                  La familia <strong>{r.cod}</strong> apunta a la tela <strong>{r.codInt}</strong>,
                  que no está en el catálogo o vale 0: mientras tanto cobra la más cara del grupo.
                </li>
              ))}
              {avisos.familiasCasiIguales.map((g) => (
                <li key={g.familias.join('|')}>
                  Las familias{' '}
                  <span className="font-mono">{g.familias.join(' y ')}</span> solo se distinguen por
                  mayúsculas. En la planilla eran la misma; acá se cobran <strong>por separado</strong>,
                  y la que está mal escrita queda sin receta ni tela de referencia propias. Conviene
                  corregir el producto para que todas digan igual.
                </li>
              ))}
              {avisos.productosSinTipo.length > 0 && (
                <li>
                  {avisos.productosSinTipo.length} productos sin tipo: entran como adicional de
                  precio fijo, no como cortina.{' '}
                  <span className="font-mono">{avisos.productosSinTipo.slice(0, 8).join(', ')}</span>
                  {avisos.productosSinTipo.length > 8 &&
                    ` y ${avisos.productosSinTipo.length - 8} más`}
                  .
                </li>
              )}
              {avisos.telasSinAncho.length > 0 && (
                <li>
                  {avisos.telasSinAncho.length} telas sin ancho de rollo: cotizan con el ancho de
                  respaldo ({reglas.anchoRolloFallbackM} m).{' '}
                  <span className="font-mono">{avisos.telasSinAncho.slice(0, 8).join(', ')}</span>
                  {avisos.telasSinAncho.length > 8 && ` y ${avisos.telasSinAncho.length - 8} más`}.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="max-h-[32rem] overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Código</th>
                <th className="px-2 py-1.5 text-left font-medium">Producto</th>
                <th className="px-2 py-1.5 text-left font-medium">Tipo</th>
                <th className="px-2 py-1.5 text-left font-medium">Diseño</th>
                <th className="px-2 py-1.5 text-right font-medium">$/m</th>
                <th className="px-2 py-1.5 text-right font-medium">Dcto.</th>
                <th className="px-2 py-1.5 text-right font-medium">Rollo</th>
                <th className="px-2 py-1.5 text-left font-medium">Cómo se cobra</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, TOPE_FILAS).map(([codInt, p]) => {
                const f = flujoDeProducto(p, codInt, catalogo, reglas);
                const ancho = Number(anchoRollo[codInt]) || Number(p.anchoRollo) || 0;
                return (
                  <tr key={codInt} className="border-t align-top">
                    <td className="px-2 py-1 font-mono">
                      {codInt}
                      <div className="text-[0.65rem] text-muted-foreground">{p.cod}</div>
                    </td>
                    <td className="px-2 py-1">
                      {p.producto}
                      <ChipGama cat={p.categoria} />
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{p.tipo}</td>
                    <td className="px-2 py-1 text-muted-foreground">{p.descripcion}</td>
                    <td className="px-2 py-1 text-right">{formatCLP(Number(p.precio) || 0)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {p.descuento ? `${Math.round(p.descuento * 100)} %` : '—'}
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">
                      {ancho > 0 ? (
                        `${ancho} m`
                      ) : (
                        <span className="text-warning">{reglas.anchoRolloFallbackM} m*</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      {f.entra === 'adicional' ? (
                        <span className="text-muted-foreground">Adicional (precio fijo)</span>
                      ) : (
                        <div className="space-y-0.5">
                          <div>
                            Receta <span className="font-mono">{f.recetaKey}</span>
                            {!f.recetaPropia && (
                              <span className="ml-1 text-[0.65rem] text-warning">de respaldo</span>
                            )}
                          </div>
                          <div className="text-[0.65rem] text-muted-foreground">
                            {f.telaReferencia ? (
                              <>
                                {f.origenPrecio === 'baseVertical' && !porLamas
                                  ? 'tela del roller '
                                  : 'tela '}
                                <span className="font-mono">{f.telaReferencia}</span> ·{' '}
                                {formatCLP(f.precioMl)}/m
                                {f.esVertical && porLamas && ' · por lamas'}
                                {f.origenPrecio === 'maxFamilia' && (
                                  <span className="text-warning"> (la más cara del grupo)</span>
                                )}
                              </>
                            ) : (
                              <span className="text-warning">sin tela que fije el precio</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditar(codInt)}
                        title="Editar este código"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filas.length && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    {loading ? 'Cargando el catálogo…' : 'Ningún producto con esos filtros.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filas.length > TOPE_FILAS && (
          <p className="mt-2 text-xs text-muted-foreground">
            Se muestran {TOPE_FILAS} de {filas.length} productos. Afina la búsqueda para ver el
            resto.
          </p>
        )}
      </section>

      {editar !== undefined && (
        <ProductoCatalogoDialog
          codInt={editar}
          catalogo={catalogo}
          anchoRollo={anchoRollo}
          onClose={() => setEditar(undefined)}
          onSaved={refrescarTodo}
        />
      )}
      {clonar && <ClonarCodigoDialog onClose={() => setClonar(false)} onSaved={refrescarTodo} />}
      {importar && (
        <ImportarCatalogoDialog onClose={() => setImportar(false)} onSaved={refrescarTodo} />
      )}

      <Dialog open={verRespaldos} onOpenChange={setVerRespaldos}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respaldos del catálogo</DialogTitle>
            <DialogDescription>
              Cada vez que se guarda el catálogo queda una foto de cómo estaba antes. Restaurar
              reemplaza el catálogo completo de inmediato.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {respaldos.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2 text-xs">
                <div>
                  <div className="font-medium">
                    {new Date(r.fecha).toLocaleString('es-CL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {r.motivo} · {codigosDelRespaldo(r)} códigos
                  </div>
                </div>
                <Button variant="ghost" size="sm" disabled={restaurando} onClick={() => restaurar(r)}>
                  Restaurar
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
