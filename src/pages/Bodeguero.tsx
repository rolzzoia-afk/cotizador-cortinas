// Orquestador de la pantalla Bodeguero (mobile-first).
//
// 7 vistas:
// - lista: lista de OTs + 3 botones ad-hoc
// - salida / entrada / devolucion: AdHocView en sus 3 modos
// - despacho: BOM de una OT seleccionada
// - scanner: state machine de escaneo (loc → item → confirmar) por cada BOM item
// - firma: pad de firma + confirmación final que descuenta stock

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  type BOMItem,
  type Insumo,
  type OT,
  type Rack,
  type TelaCatalogo,
  type TelaSlot,
  type TuboColmena,
  construirBOM,
  getUbicacionBOM,
} from '@/modules/bodega/bomUtils';

import { ESTADOS_BODEGUERO } from './bodeguero/Bodeguero.config';
import type { Contador, ScanFase, Vista } from './bodeguero/Bodeguero.types';
import ListaOTs from './bodeguero/vistas/ListaOTs';
import DespachoView from './bodeguero/vistas/DespachoView';
import ScannerView from './bodeguero/vistas/ScannerView';
import FirmaView from './bodeguero/vistas/FirmaView';
import AdHocView from './bodeguero/vistas/AdHocView';

export function Bodeguero() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista>('lista');
  const [ots, setOts] = useState<OT[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [telasCat, setTelasCat] = useState<TelaCatalogo[]>([]);
  const [telasSlots, setTelasSlots] = useState<TelaSlot[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [tubos, setTubos] = useState<TuboColmena[]>([]);
  const [otActual, setOtActual] = useState<OT | null>(null);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [contadores, setContadores] = useState<Record<number, Contador>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scanItemIdx, setScanItemIdx] = useState<number>(-1);
  const [scanFase, setScanFase] = useState<ScanFase>('loc');

  const cargar = async () => {
    if (!empresaId) return;
    setLoading(true);
    setError(null);

    try {
      const [rOts, rIns, rTelCat, rTelSlots, rRacks, rTubos] = await Promise.all([
        supabase
          .from('ots')
          .select('id, numero_ot, estado, datos_generales, items, fecha_creacion, fecha_entrega')
          .eq('empresa_id', empresaId)
          .in('estado', ESTADOS_BODEGUERO)
          .order('fecha_creacion', { ascending: false }),
        supabase
          .from('insumos')
          .select(
            'cod,nemotecnico,descriptor_proveedor,categoria,color,ubicacion,stock_mp,stock_liberado',
          )
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_catalogo')
          .select('codigo,nemotecnico,tipo,almacen,posicion')
          .eq('empresa_id', empresaId),
        supabase
          .from('telas_slots')
          .select('posicion,codigo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('ubicaciones_rack')
          .select('rack,fila,columna,codigo_insumo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('colmena_tubos')
          .select('cod,n_colmena,medida_cm')
          .eq('empresa_id', empresaId),
      ]);

      if (rOts.error) {
        const esRLS =
          rOts.error.message?.includes('policy') ||
          rOts.error.message?.includes('permission') ||
          rOts.error.code === '42501';
        setError(
          esRLS
            ? 'Sin permisos para cargar órdenes. Revisa las políticas RLS de la tabla `ots`.'
            : rOts.error.message,
        );
        return;
      }

      setOts((rOts.data as OT[]) || []);
      setInsumos((rIns.data as Insumo[]) || []);
      setTelasCat((rTelCat.data as TelaCatalogo[]) || []);
      setTelasSlots((rTelSlots.data as TelaSlot[]) || []);
      setRacks((rRacks.data as Rack[]) || []);
      setTubos((rTubos.data as TuboColmena[]) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const abrirOT = async (ot: OT) => {
    if (!empresaId) return;
    setOtActual(ot);

    const { data: bomDB } = await supabase
      .from('orden_materiales')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ot_id', ot.id)
      .order('orden');

    const bom = construirBOM(
      ot,
      (bomDB as Parameters<typeof construirBOM>[1]) || [],
      insumos,
      racks,
      telasSlots,
      telasCat,
    );
    setBomItems(bom);

    const cnt: Record<number, Contador> = {};
    bom.forEach((item, idx) => {
      cnt[idx] = {
        pickeado: item.cantidad_despachada || 0,
        requerido: item.cantidad_req || 1,
        estado: item.estado === 'completado' ? 'completo' : 'pendiente',
      };
    });
    setContadores(cnt);
    setVista('despacho');
  };

  const volverLista = () => {
    setVista('lista');
    setOtActual(null);
    setBomItems([]);
    setContadores({});
    cargar();
  };

  const iniciarScanItem = (idx: number) => {
    setScanItemIdx(idx);
    const item = bomItems[idx];
    // Si no hay ubicación conocida → ir directo a escanear item
    let tieneUbicacion = false;
    if (item._es_tela) {
      tieneUbicacion = !!item._ubicacion_rack;
    } else {
      tieneUbicacion = !!getUbicacionBOM(item, insumos, racks);
    }
    setScanFase(tieneUbicacion ? 'loc' : 'item');
    setVista('scanner');
  };

  const onConfirmItem = (idx: number, cantidad: number) => {
    setContadores((prev) => {
      const cnt = prev[idx];
      const nuevoPick = cnt.pickeado + cantidad;
      const completo = nuevoPick >= cnt.requerido;
      return {
        ...prev,
        [idx]: {
          ...cnt,
          pickeado: nuevoPick,
          estado: (completo ? 'completo' : 'parcial') as Contador['estado'],
        },
      };
    });
    setVista('despacho');
  };

  const todosCompletos = useMemo(
    () =>
      Object.values(contadores).length > 0 &&
      Object.values(contadores).every((c) => c.estado === 'completo'),
    [contadores],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/15 p-5 text-red-200">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5" /> No se pudo cargar
          </div>
          <div className="text-sm">{error}</div>
          <Button onClick={cargar} className="mt-4">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      {vista === 'lista' && (
        <ListaOTs
          ots={ots}
          onBack={() => navigate('/landing')}
          onSelect={abrirOT}
          onSalida={() => setVista('salida')}
          onEntrada={() => setVista('entrada')}
          onDevolucion={() => setVista('devolucion')}
        />
      )}
      {vista === 'salida' && (
        <AdHocView modo="salida" empresaId={empresaId || ''} onCerrar={() => setVista('lista')} />
      )}
      {vista === 'entrada' && (
        <AdHocView modo="entrada" empresaId={empresaId || ''} onCerrar={() => setVista('lista')} />
      )}
      {vista === 'devolucion' && (
        <AdHocView
          modo="devolucion"
          empresaId={empresaId || ''}
          onCerrar={() => setVista('lista')}
        />
      )}
      {vista === 'despacho' && otActual && (
        <DespachoView
          ot={otActual}
          bomItems={bomItems}
          contadores={contadores}
          insumos={insumos}
          racks={racks}
          tubos={tubos}
          todosCompletos={todosCompletos}
          onBack={volverLista}
          onIniciarScan={iniciarScanItem}
          onIrAFirma={() => setVista('firma')}
        />
      )}
      {vista === 'scanner' && otActual && scanItemIdx >= 0 && (
        <ScannerView
          item={bomItems[scanItemIdx]}
          contador={contadores[scanItemIdx]}
          insumos={insumos}
          racks={racks}
          initialFase={scanFase}
          onCerrar={() => setVista('despacho')}
          onConfirm={(cant) => onConfirmItem(scanItemIdx, cant)}
        />
      )}
      {vista === 'firma' && otActual && (
        <FirmaView
          ot={otActual}
          bomItems={bomItems}
          contadores={contadores}
          insumos={insumos}
          empresaId={empresaId || ''}
          onBack={() => setVista('despacho')}
          onDone={volverLista}
        />
      )}
    </div>
  );
}
