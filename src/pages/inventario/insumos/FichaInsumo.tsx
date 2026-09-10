// La ficha de un artículo (lámina 4): todo lo que se sabe de un insumo en una
// sola pantalla — dónde está el stock, qué se consumió y qué le pasó.
//
// Se llega desde el catálogo, desde las alertas o escaneando el QR. El código
// va en la URL (`/inventario/insumos/MEC%2018`) para que el enlace se pueda
// mandar por WhatsApp y abra la ficha exacta.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Printer, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatBox, type TonoStat } from '@/components/ui/stat-box';
import { TabButton } from '@/components/ui/tab-button';
import { badgeEstadoArticulo } from '@/modules/inventario/badges';
import { codigoVisible } from '@/modules/inventario/codigosInsumo';
import { puedeVerMontos } from '@/modules/inventario/navegacion';
import {
  coberturaMeses,
  consumoUltimosMeses,
  faltanParaMinimo,
  promedioMensual,
  saldosDeInsumo,
} from '@/modules/inventario/ficha';
import { useFichaInsumo, useGuardarMovimiento } from '@/modules/inventario/fichaStore';
import { getStockTotal } from '@/modules/inventario/helpers';
import { EMPTY_MOV_FORM } from './Insumos.config';
import type { MovForm } from './Insumos.types';
import MovDialog from './dialogs/MovDialog';
import QRInsumoDialog from './dialogs/QRInsumoDialog';
import ConsumoMeses from '@/components/inventario/ConsumoMeses';
import TablaMovimientos from '@/components/inventario/TablaMovimientos';
import {
  DatosArticulo,
  EtiquetasArticulo,
  ProveedorArticulo,
  UbicacionesArticulo,
} from './ficha/PanelesFicha';
import { useInventario } from '../InventarioLayout';

type TabFicha = 'resumen' | 'kardex' | 'ubicaciones' | 'etiquetas' | 'proveedor';

/**
 * El recuadro del total se pinta según el estado del artículo. Cuando está
 * bien va en terracota (es el número que se mira primero), no en verde: el
 * verde queda para el badge.
 */
const TONO_POR_ESTADO: Record<string, TonoStat> = {
  success: 'accent',
  warning: 'warning',
  destructive: 'destructive',
  muted: 'neutro',
};

export function FichaInsumo() {
  const { cod = '' } = useParams();
  const codigo = decodeURIComponent(cod);
  const { queryRol, puedeEditar, rol } = useInventario();
  const { insumo, movimientos, ubicaciones, camionetas, validadores, loading, error, aplicarCambio } =
    useFichaInsumo(codigo);
  const { guardando, guardar } = useGuardarMovimiento();

  const [tab, setTab] = useState<TabFicha>('resumen');
  const [qrAbierto, setQrAbierto] = useState(false);
  const [movDialog, setMovDialog] = useState<{ open: boolean; form: MovForm }>({
    open: false,
    form: { ...EMPTY_MOV_FORM },
  });

  const consumo = useMemo(() => consumoUltimosMeses(movimientos), [movimientos]);
  const promedio = useMemo(() => promedioMensual(consumo), [consumo]);

  const volver = `/inventario/insumos${queryRol}`;

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

  if (error || !insumo) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={volver} className="flex items-center gap-1.5 text-xs text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Insumos
        </Link>
        <EmptyState
          titulo={error ? 'No se pudo abrir la ficha' : `No existe el artículo ${codigo}`}
          texto={
            error ||
            'Puede que el código esté escrito distinto o que el artículo sea de otra empresa.'
          }
        />
      </div>
    );
  }

  const saldos = saldosDeInsumo(insumo, camionetas);
  const total = getStockTotal(insumo);
  const faltan = faltanParaMinimo(total, insumo.minimo);
  const estado = badgeEstadoArticulo({ total, minimo: insumo.minimo, status: insumo.status });
  const cobertura = coberturaMeses(total, promedio);
  const nombre = insumo.nemotecnico || insumo.descriptor_proveedor || '';
  // La misma regla que el catálogo y el formulario, en un solo lugar.
  const verMontos = puedeVerMontos(rol);

  const abrirMovimiento = () =>
    setMovDialog({
      open: true,
      form: { ...EMPTY_MOV_FORM, codigo: insumo.cod || '', tipo: 'NUEVO INGRESO', almacen: 'MP' },
    });

  const guardarMovimiento = async () => {
    const r = await guardar(movDialog.form, insumo);
    if (!r.ok) {
      toast.error(r.motivo);
      return;
    }
    aplicarCambio(r.resultado.parcheInsumo, r.resultado.movimiento);
    setMovDialog((s) => ({ ...s, open: false }));
    if (r.resultado.recortado) {
      toast.warning(
        'Se sacó más de lo que había: el stock quedó en 0 y la diferencia no se registró.',
      );
    } else {
      toast.success('Movimiento registrado');
    }
  };

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
              Insumos
            </Link>
            {' · '}
            <span className="text-foreground">{codigoVisible(insumo.cod, insumo.color)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/* Arriba el código con su color, que es como se lee y se imprime;
                al lado la llave, que es lo que se busca en el kardex. */}
            <h1 className="font-mono text-[1.6rem] font-semibold leading-tight tracking-tight">
              {codigoVisible(insumo.cod, insumo.color)}
            </h1>
            {codigoVisible(insumo.cod, insumo.color) !== insumo.cod && (
              <span className="font-mono text-xs text-muted-foreground">{insumo.cod}</span>
            )}
            <span className="font-serif text-[1.6rem] font-medium leading-tight tracking-[-0.02em]">
              {nombre}
            </span>
            <Badge variant={estado.variante}>{estado.texto}</Badge>
            {insumo.categoria ? (
              <Badge variant="muted">
                {insumo.categoria}
                {insumo.sub_categoria ? ` · ${insumo.sub_categoria}` : ''}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrAbierto(true)}>
            <Printer className="h-4 w-4" /> Imprimir QR
          </Button>
          {puedeEditar ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <Link to={`/inventario/insumos?editar=${encodeURIComponent(insumo.cod || '')}`}>
                  <Pencil className="h-4 w-4" /> Editar
                </Link>
              </Button>
              <Button size="sm" className="gap-1.5" onClick={abrirMovimiento}>
                <RefreshCw className="h-4 w-4" /> Nuevo movimiento
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          rotulo="Materias primas"
          valor={saldos.mp.toLocaleString('es-CL')}
          hint={insumo.ubicacion ? `rack ${insumo.ubicacion}` : 'sin ubicación'}
        />
        <StatBox
          rotulo="Liberado"
          valor={saldos.liberado.toLocaleString('es-CL')}
          hint="se descuenta primero en el despacho"
        />
        {saldos.camionetas.map((c) => (
          <StatBox
            key={c.id ?? c.nombre}
            rotulo={c.nombre}
            valor={c.cantidad.toLocaleString('es-CL')}
            hint="cargado en la camioneta"
          />
        ))}
        <StatBox
          rotulo="Total disponible"
          valor={total.toLocaleString('es-CL')}
          tono={TONO_POR_ESTADO[estado.variante] ?? 'neutro'}
          hint={
            faltan == null
              ? 'sin mínimo definido'
              : faltan > 0
                ? `mínimo ${insumo.minimo} · faltan ${faltan}`
                : `mínimo ${insumo.minimo} · cubierto`
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
          active={tab === 'ubicaciones'}
          onClick={() => setTab('ubicaciones')}
        >
          Ubicaciones
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'etiquetas'}
          onClick={() => setTab('etiquetas')}
        >
          Etiquetas
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'proveedor'}
          onClick={() => setTab('proveedor')}
        >
          Proveedor
        </TabButton>
      </div>

      {tab === 'resumen' ? (
        <div className="grid gap-3.5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3.5">
            <div className="flex h-[190px] items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
              {insumo.foto_url ? (
                <img
                  src={insumo.foto_url}
                  alt={`${insumo.cod} ${nombre}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sin foto</span>
              )}
            </div>
            <DatosArticulo insumo={insumo} verMontos={verMontos} />
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
                    texto="Cuando entre o salga material de este artículo va a aparecer acá."
                  />
                </div>
              ) : (
                <TablaMovimientos filas={movimientos.slice(0, 5)} />
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
              <TablaMovimientos filas={movimientos} />
              <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
                {movimientos.length.toLocaleString('es-CL')} movimientos · el saldo después de cada
                uno llega con el kardex de la próxima entrega.
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'ubicaciones' ? (
        <UbicacionesArticulo insumo={insumo} ubicaciones={ubicaciones} />
      ) : null}

      {tab === 'etiquetas' ? (
        <EtiquetasArticulo
          insumo={insumo}
          ubicaciones={ubicaciones}
          onImprimir={() => setQrAbierto(true)}
        />
      ) : null}

      {tab === 'proveedor' ? <ProveedorArticulo insumo={insumo} verMontos={verMontos} /> : null}

      {qrAbierto ? (
        <QRInsumoDialog insumo={insumo} ubicaciones={ubicaciones} onClose={() => setQrAbierto(false)} />
      ) : null}

      <MovDialog
        open={movDialog.open}
        form={movDialog.form}
        insumos={[insumo]}
        validadores={validadores}
        saving={guardando}
        onClose={() => setMovDialog((s) => ({ ...s, open: false }))}
        onChange={(patch) => setMovDialog((s) => ({ ...s, form: { ...s.form, ...patch } }))}
        onSave={guardarMovimiento}
      />
    </div>
  );
}

export default FichaInsumo;
