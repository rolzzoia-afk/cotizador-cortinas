// Colmena de paños: los retazos que sobran de cada corte, dibujados como el
// rack físico del galpón (lámina «Colmena de paños»).
//
// Cada zona —Galpón, Liberado, Rolzzo— es una colmena independiente y tiene su
// pestaña: mezclarlas escondería que el galpón está casi vacío mientras Rolzzo
// rebalsa. Al hacer clic en una celda el paño se abre en el panel de la
// derecha, no en una ventana encima del mapa: se compara un paño con su vecino
// sin cerrar nada.

import { useEffect, useMemo, useState } from 'react';
import { FileUp, Loader2, Plus, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmar } from '@/components/ui/confirm';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import {
  ChipBusqueda,
  ChipFiltro,
  ChipSelect,
} from '@/components/inventario/ChipsFiltro';
import ImportarColmenaDialog from '@/components/ojo-de-dios/ImportarColmenaDialog';
import { useAuth } from '@/lib/auth';
import { imprimirHtml } from '@/lib/imprimirHtml';
import { supabase } from '@/lib/supabase';
import { useParametrosCotizador } from '@/modules/cotizador/parametros';
import { usePlantillaEtiqueta } from '@/modules/etiquetas/plantillasStore';
import { medidaTexto, resumenZonas } from '@/modules/inventario/colmenaVista';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import {
  agruparPorZona,
  enAlerta,
  estadoColmena,
  tipoDeCodigo,
  zonaDe,
  type TipoTela,
} from '@/modules/telas/colmenaViva';
import { etiquetaDesdePano, htmlEtiquetasSobrante } from '@/modules/telas/etiquetaSobrante';
import GrillaColmena, { RELLENO_FAMILIA, type EstadoCelda } from './GrillaColmena';
import PanelPano from './PanelPano';
import BuscarMedidaDialog from './dialogs/BuscarMedidaDialog';
import UbicarPanoDialog from './dialogs/UbicarPanoDialog';
import { useInventario } from '../InventarioLayout';

const FAMILIAS: ReadonlyArray<{ id: TipoTela; texto: string }> = [
  { id: 'BK', texto: 'Blackout' },
  { id: 'DU', texto: 'Dúo' },
  { id: 'SC', texto: 'Screen' },
  { id: 'TR', texto: 'Translúcida' },
];

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-1.5 text-[0.72rem] text-muted-foreground">
      {FAMILIAS.map((f) => (
        <span key={f.id} className="flex items-center gap-1.5">
          <i className={`inline-block h-2.5 w-2.5 rounded-[3px] ${RELLENO_FAMILIA[f.id]}`} />
          {f.texto}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-destructive/[0.16]" />
        Con falla
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-[3px] border border-dashed border-border" />
        Libre
      </span>
    </div>
  );
}

export function VistaColmena() {
  const { empresaId } = useAuth();
  const { rol, puedeEditar } = useInventario();
  const { panos, fallas, loading, error, recargar } = useDatosTelas({ incluirPanos: true });
  const { parametros } = useParametrosCotizador();
  // El diseño de la etiqueta, listo antes del clic: si se esperara una
  // consulta en el medio, el navegador bloquearía la ventana de impresión.
  const { plantilla } = usePlantillaEtiqueta('sobrante');

  const [zonaActiva, setZonaActiva] = useState('');
  const [familia, setFamilia] = useState<TipoTela | ''>('');
  const [incluirUsados, setIncluirUsados] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resaltados, setResaltados] = useState<Set<string>>(new Set());
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [buscarMedida, setBuscarMedida] = useState(false);
  const [importar, setImportar] = useState(false);
  const [ubicar, setUbicar] = useState<'ingresar' | 'mover' | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);

  // Fecha de referencia de la alerta de antigüedad, estable por montaje.
  const hoy = useMemo(() => new Date().toISOString(), []);
  const diasAlerta = parametros.diasAlertaColmena;

  const zonas = useMemo(() => resumenZonas(panos, hoy, diasAlerta), [panos, hoy, diasAlerta]);
  const zona = zonaActiva || zonas[0]?.zona || '';
  const disponibles = useMemo(
    () => panos.filter((p) => p.disponible && !p.datos_extra?.baja).length,
    [panos],
  );
  const agrupadas = useMemo(() => agruparPorZona(panos), [panos]);
  const grupoActivo = agrupadas.find((z) => z.zona === zona);
  const resumenActivo = zonas.find((z) => z.zona === zona);

  const fallaCodes = useMemo(
    () =>
      new Set(
        fallas.filter((f) => f.resuelto === 'NO').map((f) => (f.codigo || '').toUpperCase().trim()),
      ),
    [fallas],
  );

  const q = busqueda.trim().toLowerCase();
  const estadoDe = (p: (typeof panos)[number]): EstadoCelda => ({
    alerta: enAlerta(p, hoy, diasAlerta),
    falla: fallaCodes.has((p.codigo || '').toUpperCase().trim()),
    apagado:
      (!incluirUsados && (!p.disponible || !!p.datos_extra?.baja)) ||
      (!!familia && tipoDeCodigo(p.codigo) !== familia),
    resaltado: resaltados.has(p.id) || (q !== '' && (p.codigo || '').toLowerCase().includes(q)),
  });

  const elegido = useMemo(() => panos.find((p) => p.id === elegidoId) ?? null, [panos, elegidoId]);
  // En las zonas de repisa un estante guarda varias telas: las demás se
  // ofrecen en el panel para saltar entre ellas.
  const vecinos = useMemo(() => {
    if (!elegido || !elegido.ubicacion) return [];
    return panos.filter(
      (p) => p.id !== elegido.id && zonaDe(p) === zonaDe(elegido) && p.ubicacion === elegido.ubicacion,
    );
  }, [panos, elegido]);

  // Al cambiar de zona el paño elegido deja de estar en pantalla.
  useEffect(() => {
    if (elegido && zonaDe(elegido) !== zona) setElegidoId(null);
  }, [elegido, zona]);

  const etiqueta = elegido ? etiquetaDesdePano(elegido, parametros) : null;
  const estadoElegido = elegido
    ? estadoColmena(elegido, hoy, diasAlerta)
    : { estado: 'activa' as const, dias: null };

  const imprimirEtiqueta = () => {
    if (!etiqueta) return;
    imprimirHtml(htmlEtiquetasSobrante([etiqueta], plantilla));
  };

  // Dar de baja un paño viejo (Reglas Rolzzo, sección 6): sale del inventario
  // activo y queda registrado como merma, con de dónde venía.
  const darDeBaja = async () => {
    if (!elegido || !empresaId) return;
    const ok = await confirmar({
      titulo: 'Dar de baja el paño',
      mensaje:
        `¿Dar de baja ${elegido.codigo} (${medidaTexto(elegido.medida_ancho, elegido.medida_alto)} cm)?\n\n` +
        'Sale del inventario activo y se registra como merma. No se usará en cortes.',
      confirmLabel: 'Dar de baja',
      destructivo: true,
    });
    if (!ok) return;
    setBajando(elegido.id);
    try {
      const ahora = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('colmena_panos')
        .update({
          disponible: false,
          datos_extra: {
            ...(elegido.datos_extra || {}),
            baja: true,
            fecha_baja: ahora,
            motivo_baja: 'antiguedad',
          },
        })
        .eq('id', elegido.id);
      if (upErr) throw upErr;
      const { error: mErr } = await supabase.from('telas_mermas').insert({
        empresa_id: empresaId,
        codigo: elegido.codigo,
        medida_ancho: elegido.medida_ancho,
        medida_alto: elegido.medida_alto,
        motivo: 'baja_antiguedad',
        colmena_origen_id: elegido.id,
        fecha: ahora,
      });
      if (mErr) console.warn('[Colmena] merma de baja no registrada:', mErr.message);
      toast.success(`${elegido.codigo} dado de baja y registrado como merma.`);
      await recargar();
    } catch (e) {
      toast.error('No se pudo dar de baja: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBajando(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        miga="Inventario"
        titulo="Colmena de paños"
        hint={
          loading
            ? 'Cargando…'
            : `${disponibles.toLocaleString('es-CL')} paños disponibles · lo que sobra de cada corte, listo para volver a usarse`
        }
        acciones={
          !loading && !error ? (
            <>
              {rol === 'admin' && (
                <Button variant="outline" onClick={() => setImportar(true)}>
                  <FileUp className="h-4 w-4" />
                  Importar mapa
                </Button>
              )}
              <Button variant="outline" onClick={() => setBuscarMedida(true)}>
                <Ruler className="h-4 w-4" />
                Buscar medida
              </Button>
              {puedeEditar && (
                <Button onClick={() => setUbicar('ingresar')}>
                  <Plus className="h-4 w-4" />
                  Ingresar paño
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-5 border-b border-border">
            {zonas.map((z) => (
              <TabButton
                key={z.zona}
                variante="subrayado"
                active={z.zona === zona}
                onClick={() => setZonaActiva(z.zona)}
                badge={
                  <Badge variant={z.zona === zona ? 'accent' : 'muted'}>
                    {z.disponibles.toLocaleString('es-CL')}
                  </Badge>
                }
              >
                {z.label}
              </TabButton>
            ))}
            <div className="ml-auto">
              <Leyenda />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ChipSelect
              valor={familia}
              onChange={(v) => setFamilia(v as TipoTela | '')}
              etiqueta="Familia de tela"
            >
              <option value="">Familia</option>
              {FAMILIAS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.texto}
                </option>
              ))}
            </ChipSelect>
            <ChipFiltro
              activo={incluirUsados}
              onClick={() => setIncluirUsados((v) => !v)}
              titulo="Mostrar también los paños ya cortados y los dados de baja"
            >
              Incluir usados
            </ChipFiltro>
            {resaltados.size > 0 && (
              <ChipFiltro activo onClick={() => setResaltados(new Set())}>
                {resaltados.size} marcados por medida · quitar
              </ChipFiltro>
            )}
            <div className="ml-auto">
              <ChipBusqueda
                valor={busqueda}
                onChange={setBusqueda}
                placeholder="Código de tela"
                etiqueta="Resaltar un código en el mapa"
                ancho="w-[160px]"
              />
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-serif text-[0.9375rem] font-medium">
                  {resumenActivo?.label ?? 'Colmena'}
                  {grupoActivo?.modo === 'grid'
                    ? ` · ${grupoActivo.racks.length} racks`
                    : grupoActivo
                      ? ` · ${grupoActivo.sectores.reduce((n, s) => n + s.slots.length, 0)} estantes`
                      : ''}
                </h2>
                {(resumenActivo?.alerta ?? 0) > 0 && (
                  <Badge variant="warning" className="ml-auto">
                    {resumenActivo?.alerta.toLocaleString('es-CL')} paños sobre {diasAlerta} días
                  </Badge>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {grupoActivo ? (
                  <GrillaColmena
                    zona={grupoActivo}
                    estadoDe={estadoDe}
                    elegidoId={elegidoId}
                    onElegir={(p) => setElegidoId(p.id)}
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    La colmena está vacía.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-2 text-[0.72rem] text-muted-foreground">
                <span>
                  Cada celda es una posición física del rack. El color dice la familia; el borde
                  naranja, que lleva más de {diasAlerta} días.
                </span>
                <Badge variant="muted" className="ml-auto">
                  {elegidoId ? 'Clic en otra celda para comparar' : 'Clic en una celda para ver el paño'}
                </Badge>
              </div>
            </div>

            <div className="hidden min-h-0 lg:flex lg:flex-col">
              <PanelPano
                pano={elegido}
                etiqueta={etiqueta}
                estado={estadoElegido.estado}
                dias={estadoElegido.dias}
                tieneFalla={!!elegido && fallaCodes.has((elegido.codigo || '').toUpperCase().trim())}
                vecinos={vecinos}
                puedeEditar={puedeEditar}
                onElegir={(p) => setElegidoId(p.id)}
                onImprimir={imprimirEtiqueta}
                onMover={() => setUbicar('mover')}
                onDarDeBaja={() => void darDeBaja()}
                bajando={bajando === elegido?.id}
              />
            </div>
          </div>
        </>
      )}

      {buscarMedida && (
        <BuscarMedidaDialog
          panos={panos}
          onClose={() => setBuscarMedida(false)}
          onElegir={(p) => {
            setZonaActiva(zonaDe(p));
            setElegidoId(p.id);
            setBuscarMedida(false);
          }}
          onResaltar={setResaltados}
        />
      )}
      {importar && (
        <ImportarColmenaDialog onClose={() => setImportar(false)} onSaved={() => void recargar()} />
      )}
      {ubicar && (
        <UbicarPanoDialog
          modo={ubicar}
          pano={ubicar === 'mover' ? elegido : null}
          panos={panos}
          empresaId={empresaId || ''}
          zonaInicial={zona || 'GALPON'}
          onClose={() => setUbicar(null)}
          onGuardado={recargar}
        />
      )}
    </div>
  );
}

export default VistaColmena;
