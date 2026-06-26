// Orquestador de la pantalla Inventario de Telas.
//
// 4 tabs: Catálogo / Colmena (rack visual) / Movimientos / Fallas.
// Carga 5 datasets en paralelo y construye el mapa de colmena combinando
// telas.posicion con telas_slots. Cada tab vive en su archivo bajo
// ./telas/tabs/, y los modales bajo ./telas/dialogs/.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Boxes,
  Loader2,
  PencilRuler,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

import type {
  Colmena,
  Falla,
  Movimiento,
  Slot,
  Tab,
  Tela,
  Validador,
  ValidadoresMap,
} from './telas/Telas.types';
import CatalogoTab from './telas/tabs/CatalogoTab';
import RackTab from './telas/tabs/RackTab';
import MovimientosTab from './telas/tabs/MovimientosTab';
import FallasTab from './telas/tabs/FallasTab';

export function Telas() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('catalogo');
  const [loading, setLoading] = useState(true);

  const [telas, setTelas] = useState<Tela[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [fallas, setFallas] = useState<Falla[]>([]);
  const [validadores, setValidadores] = useState<ValidadoresMap>({});
  const [colmena, setColmena] = useState<Colmena>({});

  const cargarTodo = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [rTelas, rSlots, rMov, rFallas, rVal] = await Promise.all([
        supabase.from('telas_catalogo').select('*').eq('empresa_id', empresaId).order('codigo'),
        supabase
          .from('telas_slots')
          .select('posicion,codigo,almacen')
          .eq('empresa_id', empresaId),
        supabase
          .from('movimientos_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false })
          .limit(500),
        supabase
          .from('telas_fallas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha_reporte', { ascending: false }),
        supabase
          .from('validadores_telas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('orden'),
      ]);

      const telasData = (rTelas.data as Tela[]) || [];
      setTelas(telasData);
      setMovimientos((rMov.data as Movimiento[]) || []);
      setFallas((rFallas.data as Falla[]) || []);

      const vmap: ValidadoresMap = {};
      ((rVal.data as Validador[]) || []).forEach((v) => {
        if (!vmap[v.campo]) vmap[v.campo] = [];
        vmap[v.campo].push(v.valor);
      });
      setValidadores(vmap);

      // Colmena: arranca desde telas.posicion (legacy), después sobreescribe
      // con telas_slots si hay datos ahí. Los slots son la fuente de verdad
      // moderna pero algunas empresas todavía no las usan.
      const catMap: Record<string, Tela> = {};
      telasData.forEach((t) => {
        catMap[t.codigo] = t;
      });

      let col: Colmena = {};
      telasData.forEach((t) => {
        if (t.posicion) {
          col[t.posicion.toUpperCase()] = {
            codigo: t.codigo,
            tipo: t.tipo,
            nemotecnico: t.nemotecnico,
            almacen: t.almacen,
            id: t.id,
          };
        }
      });
      const slotsData = (rSlots.data as Slot[]) || [];
      if (slotsData.length) {
        col = {};
        slotsData.forEach((s) => {
          if (!s.posicion || !s.codigo) return;
          const cat = catMap[s.codigo];
          col[s.posicion.toUpperCase()] = {
            codigo: s.codigo,
            tipo: cat?.tipo ?? null,
            nemotecnico: cat?.nemotecnico ?? null,
            almacen: s.almacen || cat?.almacen || null,
            id: cat?.id ?? null,
          };
        });
      }
      setColmena(col);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const fallasPendientes = useMemo(
    () => fallas.filter((f) => f.resuelto === 'NO').length,
    [fallas],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => navigate('/landing')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Inicio
        </button>
        <h1 className="flex-1 text-base font-bold">Inventario de Telas</h1>
      </div>

      <div className="border-b border-border bg-background px-5">
        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { k: 'catalogo', l: 'Catálogo', i: <Boxes className="h-4 w-4" /> },
              { k: 'rack', l: 'Colmena', i: <PencilRuler className="h-4 w-4" /> },
              { k: 'movimientos', l: 'Movimientos', i: <ArrowLeftRight className="h-4 w-4" /> },
              { k: 'fallas', l: 'Fallas', i: <AlertTriangle className="h-4 w-4" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                'relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition',
                tab === t.k
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.i}
              {t.l}
              {t.k === 'fallas' && fallasPendientes > 0 && (
                <span className="ml-1 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[12px] font-bold text-destructive">
                  {fallasPendientes}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'catalogo' && (
        <CatalogoTab
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
          colmena={colmena}
        />
      )}
      {tab === 'rack' && <RackTab telas={telas} fallas={fallas} colmena={colmena} />}
      {tab === 'movimientos' && (
        <MovimientosTab
          movimientos={movimientos}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
        />
      )}
      {tab === 'fallas' && (
        <FallasTab
          fallas={fallas}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={cargarTodo}
        />
      )}
    </div>
  );
}
