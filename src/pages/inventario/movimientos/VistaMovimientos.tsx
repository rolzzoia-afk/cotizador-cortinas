// Kardex: todo lo que entró, salió o se movió.
//
// Un solo libro para insumos y telas, con el saldo que quedó después de cada
// movimiento. El interruptor de la derecha suma lo que se movió ANTES de que el
// kardex existiera —los registros viejos, los cortes de tubos y los paños—: esas
// filas se ven en gris porque se consultan, no se corrigen desde acá.
//
// Sin el kardex encendido no hay libro que mostrar, así que la pantalla lo dice
// y ofrece el camino: Inventario → Configuración.

import { useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useFlagsInventario } from '@/modules/inventario/flagsStore';
import { useKardex } from '@/modules/inventario/kardexStore';
import {
  almacenesPresentes,
  companerosDeLote,
  csvDeKardex,
  desdeDelRango,
  filtrarFilas,
  FILTROS_VACIOS,
  textoRango,
  usuariosPresentes,
  type FilaKardexVista,
  type FiltrosVista,
  type Rango,
} from '@/modules/inventario/kardexVista';
import { useInventario } from '../InventarioLayout';
import DetalleMovimiento from './DetalleMovimiento';
import FiltrosKardex from './FiltrosKardex';
import NuevoMovimientoDialog from './NuevoMovimientoDialog';
import TablaKardex from './TablaKardex';

function descargarCsv(texto: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function VistaMovimientos() {
  const { queryRol, puedeEditar } = useInventario();
  const { flags, loading: cargandoFlags } = useFlagsInventario();

  const [rango, setRango] = useState<Rango>('7d');
  const [tipo, setTipo] = useState('');
  const [historico, setHistorico] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosVista>(FILTROS_VACIOS);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [abrirNuevo, setAbrirNuevo] = useState(false);

  const desde = useMemo(() => desdeDelRango(rango), [rango]);
  const { movimientos, total, loading, error, refrescar } = useKardex({
    desde,
    tipo: tipo as never,
    incluirHistorico: historico,
  });

  const filas = useMemo(() => filtrarFilas(movimientos, filtros), [movimientos, filtros]);
  const almacenes = useMemo(() => almacenesPresentes(movimientos), [movimientos]);
  const usuarios = useMemo(() => usuariosPresentes(movimientos), [movimientos]);

  // La fila elegida se busca por id: si un filtro la sacó de la lista, el panel
  // se vacía en vez de seguir mostrando algo que ya no está en pantalla.
  const seleccionada = useMemo(
    () => filas.find((f) => f.id === seleccionadaId) ?? null,
    [filas, seleccionadaId],
  );
  useEffect(() => {
    if (filas.length > 0 && !seleccionada) setSeleccionadaId(filas[0].id);
  }, [filas, seleccionada]);

  const verLote = (m: FilaKardexVista) => {
    if (!m.lote_id) return;
    // Se busca por la OT porque es lo que la persona reconoce; el lote es un
    // número interno que no le dice nada a nadie.
    setFiltros({ ...FILTROS_VACIOS, busqueda: m.ot || '' });
    toast.info(`Mostrando los ${companerosDeLote(movimientos, m) + 1} movimientos del despacho`);
  };

  const exportar = () => {
    if (filas.length === 0) {
      toast.warning('No hay movimientos que exportar con estos filtros.');
      return;
    }
    descargarCsv(csvDeKardex(filas), `kardex-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`${filas.length.toLocaleString('es-CL')} movimientos exportados`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        miga="Inventario"
        titulo="Kardex"
        hint="Todo lo que entró, salió o se movió. No se edita ni se borra: se corrige con otro movimiento."
        acciones={
          <>
            <Button variant="outline" onClick={exportar}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            {puedeEditar && flags.kardexRpc && (
              <Button onClick={() => setAbrirNuevo(true)}>
                <Plus className="h-4 w-4" />
                Nuevo movimiento
              </Button>
            )}
          </>
        }
      />

      {!flags.kardexRpc && !cargandoFlags && (
        <div className="rounded-lg border border-accent/35 bg-accent/[0.09] px-4 py-3 text-xs leading-relaxed">
          El libro todavía no está encendido: acá se ve solo lo que quedó registrado antes, sin el
          saldo que dejó cada movimiento. Para empezar a llevarlo hay que encender «Registrar los
          movimientos en la base», en Inventario → Configuración.
        </div>
      )}

      <FiltrosKardex
        filtros={filtros}
        onFiltros={setFiltros}
        rango={rango}
        onRango={setRango}
        tipo={tipo}
        onTipo={setTipo}
        historico={historico}
        onHistorico={setHistorico}
        almacenes={almacenes}
        usuarios={usuarios}
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_296px]">
          <TablaKardex
            filas={filas}
            total={total}
            loading={loading}
            seleccionada={seleccionada}
            onSeleccionar={(m) => setSeleccionadaId(m.id)}
            hayHistorico={historico}
            textoRango={textoRango(rango)}
          />
          <div className="hidden min-h-0 lg:flex lg:flex-col">
            <DetalleMovimiento
              m={seleccionada}
              companeros={seleccionada ? companerosDeLote(movimientos, seleccionada) : 0}
              queryRol={queryRol}
              onVerLote={() => seleccionada && verLote(seleccionada)}
              onCorregir={() => {
                if (seleccionada) setAbrirNuevo(true);
              }}
            />
          </div>
        </div>
      )}

      {abrirNuevo && (
        <NuevoMovimientoDialog
          corrigiendo={seleccionada}
          onClose={() => setAbrirNuevo(false)}
          onGuardado={() => {
            setAbrirNuevo(false);
            void refrescar();
          }}
        />
      )}
    </div>
  );
}

export default VistaMovimientos;
