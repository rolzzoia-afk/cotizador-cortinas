// Alertas y reposición: qué está por acabarse y qué hay que pedir
// (lámina «Alertas y reposición»).
//
// El punto de reposición se ajusta ACÁ MISMO, en la fila. Antes había que
// entrar a la ficha de cada artículo, y por eso la mayoría del catálogo nunca
// tuvo mínimo: sin mínimo nadie avisa, y el faltante se descubre cuando frena
// el armado.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BarraGuardarSticky } from '@/components/admin/BarraGuardarSticky';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatBox } from '@/components/ui/stat-box';
import { ChipBusqueda, ChipFiltro, ChipSelect } from '@/components/inventario/ChipsFiltro';
import { DialogoReposicion } from '@/components/inventario/DialogoReposicion';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  cantidadSugerida,
  conBorrador,
  filtrarAlertas,
  FILTROS_ALERTAS,
  ordenarAlertas,
  pideAtencion,
  resumenAlertas,
  resumenCambios,
  textoCantidad,
  textoCobertura,
  unidadDe,
  type ArticuloAlerta,
  type BorradorAlertas,
  type DominioAlerta,
  type FiltroAlertas,
} from '@/modules/inventario/alertas';
import { guardarPuntosDeReposicion, useAlertas } from '@/modules/inventario/alertasStore';
import { lineasParaSolicitud } from '@/modules/inventario/comprasSolicitud';
import { sumarASolicitud } from '@/modules/inventario/comprasStore';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { mesActual } from '@/modules/inventario/helpers';
import TablaAlertas from './TablaAlertas';
import { useInventario } from '../InventarioLayout';

function descargarCsv(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * El camino de antes: una fila que NO mueve stock, solo para dejar constancia.
 * Se conserva para cuando el módulo de Compras está apagado.
 *
 * CADA DOMINIO EN SU TABLA: la ficha de una tela lee `movimientos_telas` y la
 * de un insumo `movimientos_insumos`. Un pedido de tela anotado del lado de los
 * insumos no aparece en ninguna parte donde alguien lo vaya a buscar.
 */
async function anotarPedidoViejo(
  pedido: ArticuloAlerta,
  cantidad: number,
  empresaId: string,
): Promise<void> {
  const fecha = new Date().toISOString();
  const nota = `Pedido de reposición: ${pedido.nombre}`;
  if (pedido.dominio === 'tela') {
    // Los metros llevan decimales y la columna los admite: no se redondea.
    const { error } = await supabase.from('movimientos_telas').insert({
      empresa_id: empresaId,
      fecha,
      tipo: 'PEDIDO REPOSICION',
      codigo: pedido.codigo,
      almacen: 'MP',
      metros: cantidad,
      responsable: 'Inventario',
      notas: nota,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('movimientos_insumos').insert({
    empresa_id: empresaId,
    fecha,
    mes: mesActual(),
    tipo: 'PEDIDO REPOSICION',
    codigo: pedido.codigo,
    producto: pedido.nombre,
    almacen: 'MP',
    // La columna es entera: un pedido de 2,5 cajas no se puede guardar.
    cantidad: Math.round(cantidad),
    responsable_entrega: 'Inventario',
    bitacora: nota,
  });
  if (error) throw error;
}

/** BOM + punto y coma + CRLF: así lo abre Excel en español sin pelear. */
function csvDeAlertas(filas: ArticuloAlerta[]): string {
  const cab = ['Código', 'Artículo', 'Dominio', 'Ahora', 'Mínimo', 'Dejar en', 'Sugerido', 'Cobertura'];
  const lineas = filas.map((a) =>
    [
      a.codigo,
      a.nombre,
      a.dominio === 'tela' ? 'Tela' : 'Insumo',
      textoCantidad(a.ahora, a.dominio),
      a.minimo ?? '',
      a.maximo ?? '',
      cantidadSugerida(a) ?? '',
      textoCobertura(a).texto,
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(';'),
  );
  return '﻿' + [cab.join(';'), ...lineas].join('\r\n');
}

export function VistaAlertas() {
  const { empresaId } = useAuth();
  const { puedeEditar, queryRol } = useInventario();
  const { articulos, pedidosEnCamino, loading, error, recargar } = useAlertas();
  const { flags } = useFlagsInventario();
  const comprasEncendido = flags.compras;

  const [filtro, setFiltro] = useState<FiltroAlertas>('atencion');
  const [busqueda, setBusqueda] = useState('');
  const [dominios, setDominios] = useState<Set<DominioAlerta>>(new Set());
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [borrador, setBorrador] = useState<BorradorAlertas>({});
  const [guardando, setGuardando] = useState(false);
  const [pedido, setPedido] = useState<ArticuloAlerta | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  // Todo se calcula sobre el artículo CON el borrador encima: al bajar un
  // mínimo, la alerta tiene que apagarse antes de guardar, o no se ve el
  // efecto de lo que se está por confirmar.
  const conCambios = useMemo(
    () => articulos.map((a) => conBorrador(a, borrador)),
    [articulos, borrador],
  );
  const resumen = useMemo(() => resumenAlertas(conCambios), [conCambios]);
  const filas = useMemo(
    () => ordenarAlertas(filtrarAlertas(conCambios, filtro, busqueda, dominios)),
    [conCambios, filtro, busqueda, dominios],
  );
  const frase = resumenCambios(borrador);

  const cambiar = (id: string, campo: 'minimo' | 'maximo', valor: number | null) =>
    setBorrador((b) => ({ ...b, [id]: { ...b[id], [campo]: valor } }));

  const tocado = (id: string, campo: 'minimo' | 'maximo') => borrador[id]?.[campo] !== undefined;

  const marcar = (id: string) =>
    setMarcados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const guardar = async () => {
    setGuardando(true);
    const r = await guardarPuntosDeReposicion(borrador);
    setGuardando(false);
    if (!r.ok) {
      toast.error('No se pudo guardar: ' + r.motivo);
      return;
    }
    toast.success(
      r.guardados === 1 ? '1 artículo actualizado' : `${r.guardados} artículos actualizados`,
    );
    setBorrador({});
    await recargar();
  };

  // Pedir reposición SUMA A LA SOLICITUD ABIERTA, la que bodega le manda a
  // Gerencia. Antes esto escribía una fila `PEDIDO REPOSICION` en el registro
  // viejo de movimientos: una anotación que no movía stock, sin estado y que
  // nadie contestaba nunca.
  //
  // Con el módulo de Compras apagado se conserva el camino de antes, para no
  // dejar a la bodega sin ninguna forma de anotar lo que falta.
  const confirmarPedido = async (cantidad: number) => {
    if (!pedido || !empresaId) return;
    setPidiendo(true);
    try {
      if (comprasEncendido) {
        const r = await sumarASolicitud(
          lineasParaSolicitud([
            {
              dominio: pedido.dominio,
              codigo: pedido.codigo,
              nombre: pedido.nombre,
              ahora: pedido.ahora,
              minimo: pedido.minimo,
              cantidad,
              proveedor: proveedorDe(pedido.id),
              bajoMinimo: pedido.minimo != null && pedido.ahora <= pedido.minimo,
            },
          ]),
        );
        toast.success(
          `${pedido.nombre} en el pedido ${r.numero}` +
            (r.creada ? ' (recién abierto)' : '') +
            '. Se manda a Gerencia desde Compras.',
        );
      } else {
        await anotarPedidoViejo(pedido, cantidad, empresaId);
        const guardada = pedido.dominio === 'tela' ? cantidad : Math.round(cantidad);
        toast.success(
          `Pedido anotado: ${textoCantidad(guardada, pedido.dominio)} ${unidadDe(pedido.dominio)} de ${pedido.nombre}`,
        );
      }
      setPedido(null);
      await recargar();
    } catch (e) {
      toast.error('No se pudo registrar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPidiendo(false);
    }
  };

  /** El proveedor anotado en el artículo, para que Gerencia sepa a quién pedirle. */
  const proveedorDe = (id: string): string | null =>
    (articulos.find((a) => a.id === id) as { proveedor?: string | null } | undefined)?.proveedor ??
    null;

  const crearSolicitud = async () => {
    const elegidos = filas.filter((f) => marcados.has(f.id));
    if (elegidos.length === 0) {
      toast.warning('Marca al menos un artículo.');
      return;
    }
    const sinObjetivo = elegidos.filter((a) => cantidadSugerida(a) == null);
    if (sinObjetivo.length > 0) {
      toast.warning(
        `${sinObjetivo.length} de los marcados no tiene «dejar en» definido: sin eso no hay cuánto pedir.`,
      );
      return;
    }

    // Sin el módulo encendido no hay a quién mandarle el pedido: queda el CSV,
    // que es lo que se venía haciendo.
    if (!comprasEncendido) {
      descargarCsv(
        csvDeAlertas(elegidos),
        `reposicion-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success(
        `${elegidos.length} artículos exportados. Con Compras encendido esto arma la solicitud.`,
      );
      return;
    }

    setPidiendo(true);
    try {
      const r = await sumarASolicitud(
        lineasParaSolicitud(
          elegidos.map((a) => ({
            dominio: a.dominio,
            codigo: a.codigo,
            nombre: a.nombre,
            ahora: a.ahora,
            minimo: a.minimo,
            cantidad: cantidadSugerida(a) ?? 0,
            proveedor: proveedorDe(a.id),
            bajoMinimo: pideAtencion(a),
          })),
        ),
      );
      toast.success(
        `${r.nuevas + r.sumadas} artículos en el pedido ${r.numero}. Se manda a Gerencia desde Compras.`,
      );
      setMarcados(new Set());
      await recargar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setPidiendo(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        miga="Inventario"
        titulo="Alertas y reposición"
        hint="Qué está por acabarse y qué hay que pedir. El punto de reposición se ajusta acá mismo."
        acciones={
          <>
            <Button variant="outline" onClick={() => descargarCsv(csvDeAlertas(filas), 'alertas.csv')}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            {puedeEditar && (
              <Button onClick={() => void crearSolicitud()} disabled={pidiendo}>
                {comprasEncendido ? 'Sumar lo marcado al pedido' : 'Crear solicitud con lo marcado'}
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox
          rotulo="Sin stock"
          valor={resumen.sinStock}
          tono={resumen.sinStock > 0 ? 'destructive' : 'neutro'}
          hint="frenan el armado"
        />
        <StatBox
          rotulo="Bajo mínimo"
          valor={resumen.bajoMinimo}
          tono={resumen.bajoMinimo > 0 ? 'warning' : 'neutro'}
          hint="conviene pedirlos ya"
        />
        <StatBox
          rotulo="Sin mínimo definido"
          valor={resumen.sinMinimo}
          hint="nunca van a avisar"
        />
        <StatBox
          rotulo="Pedidos en camino"
          valor={pedidosEnCamino.total}
          hint={
            pedidosEnCamino.masViejoDias != null
              ? `el más viejo, hace ${pedidosEnCamino.masViejoDias} días`
              : 'ninguno registrado'
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ChipSelect
          valor={filtro === 'atencion' ? '' : filtro}
          onChange={(v) => setFiltro((v || 'atencion') as FiltroAlertas)}
          etiqueta="Qué mostrar"
        >
          {FILTROS_ALERTAS.map((f) => (
            <option key={f.id} value={f.id === 'atencion' ? '' : f.id}>
              {f.texto}
            </option>
          ))}
        </ChipSelect>
        <ChipFiltro
          activo={dominios.has('insumo')}
          onClick={() =>
            setDominios((s) => {
              const n = new Set(s);
              if (n.has('insumo')) n.delete('insumo');
              else n.add('insumo');
              return n;
            })
          }
        >
          Insumos
        </ChipFiltro>
        <ChipFiltro
          activo={dominios.has('tela')}
          onClick={() =>
            setDominios((s) => {
              const n = new Set(s);
              if (n.has('tela')) n.delete('tela');
              else n.add('tela');
              return n;
            })
          }
        >
          Telas
        </ChipFiltro>
        {marcados.size > 0 && (
          <ChipFiltro activo onClick={() => setMarcados(new Set())}>
            {marcados.size} marcados · quitar
          </ChipFiltro>
        )}
        <div className="ml-auto">
          <ChipBusqueda
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Código o artículo"
            etiqueta="Buscar por código o artículo"
            ancho="w-[170px]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <TablaAlertas
          filas={filas}
          total={conCambios.length}
          marcados={marcados}
          onMarcar={marcar}
          onMarcarTodos={() =>
            setMarcados((s) =>
              filas.every((f) => s.has(f.id)) ? new Set() : new Set(filas.map((f) => f.id)),
            )
          }
          tocado={tocado}
          onCambiar={cambiar}
          onPedir={setPedido}
          puedeEditar={puedeEditar}
        />
      )}

      <div className="rounded-lg border border-border bg-secondary/40 px-3.5 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {comprasEncendido ? (
          <>
            <b className="font-medium text-foreground">Lo que se marca acá arma el pedido</b> que
            bodega le manda a Gerencia. Se revisa y se manda desde{' '}
            <Link to={`/inventario/compras${queryRol}`} className="text-accent hover:underline">
              Compras
            </Link>
            , donde también se ve en qué orden quedó cada artículo.
          </>
        ) : (
          <>
            <b className="font-medium text-foreground">El módulo de Compras está apagado.</b> Por
            ahora «Pedir» deja la anotación de siempre y «Crear solicitud» baja la lista marcada.
            Encendido, las dos cosas arman el pedido que se le manda a Gerencia.
            {pedidosEnCamino.total === 0 && ' Hoy no hay ningún pedido registrado.'}
          </>
        )}
      </div>

      <BarraGuardarSticky
        visible={!!frase}
        guardando={guardando}
        mensaje={frase ?? undefined}
        etiquetaGuardar="Guardar"
        onGuardar={() => void guardar()}
        onDescartar={() => setBorrador({})}
      />

      {pedido && (
        <DialogoReposicion
          abierto
          codigo={pedido.codigo}
          nombre={pedido.nombre}
          stockActual={pedido.ahora}
          minimo={Number(pedido.minimo || 0)}
          sugerida={
            // Los insumos se piden en unidades enteras; las telas, en metros con
            // decimales: redondear la sugerencia de una tela a la unidad pide de
            // más sin decirlo.
            pedido.dominio === 'tela'
              ? Math.max(0.1, cantidadSugerida(pedido) ?? 1)
              : Math.max(1, Math.ceil(cantidadSugerida(pedido) ?? 1))
          }
          guardando={pidiendo}
          onCerrar={() => setPedido(null)}
          onConfirmar={({ cantidad }) => void confirmarPedido(cantidad)}
        />
      )}
    </div>
  );
}

export default VistaAlertas;
