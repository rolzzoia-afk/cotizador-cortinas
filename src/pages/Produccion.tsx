// ─────────────────────────────────────────────────────────────────────
// Producción — el taller en pantalla.
//
// Hasta ahora el taller trabajaba con el Excel del plan de corte y los PDF de
// la OT impresos. Acá se ven en la pantalla y el operario va marcando lo que
// hizo; el avance se comparte en vivo con los demás y, al cerrar un área, la
// OT se mueve sola de sub-etapa.
//
// La OT se escribe UNA vez arriba y manda en todas las pestañas: el taller
// trabaja una orden a la vez, no una pestaña a la vez.
// ─────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Boxes,
  ClipboardCheck,
  DollarSign,
  Hammer,
  ListChecks,
  Ruler,
  Scissors,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';
import { useAvanceSubEtapa, useOTPorNumero } from '@/modules/produccion/hooks';
import type { LoteProduccion } from '@/modules/produccion/lotes';
import type { AreaProduccion } from '@/modules/produccion/types';
import BandejaAvisos from './produccion/components/BandejaAvisos';
import BarraLote from './produccion/components/BarraLote';
import BuscadorOT from './produccion/components/BuscadorOT';
import TabButton from './produccion/components/TabButton';
import VistaCalculo from './produccion/vistas/VistaCalculo';
import VistaCola from './produccion/vistas/VistaCola';
// Va con el resto y no en `lazy()` a propósito: un import dinámico acá arrastra
// el helper de precarga de Vite, que Rollup dejó dentro del chunk de jsPDF. Se
// ahorraban 18 kB y se bajaban 395.
import VistaCosto from './produccion/vistas/VistaCosto';
import VistaEstructura from './produccion/vistas/VistaEstructura';
import VistaInventario from './produccion/vistas/VistaInventario';
import VistaPanos from './produccion/vistas/VistaPanos';
import VistaPrueba from './produccion/vistas/VistaPrueba';

// 'cola' es la portada: qué hay en el taller AHORA. Las demás pestañas
// trabajan la OT que se eligió acá (o se escribió en el buscador).
type Tab = 'cola' | AreaProduccion | 'costo';

export function Produccion() {
  const { perfil } = useAuth();
  const admin = esRolAdmin(perfil?.rol);
  const [tab, setTab] = useState<Tab>('cola');
  const [ot, setOt] = useState('');
  // El lote que se está trabajando. NO fusiona las áreas —cada OT tiene su plan,
  // sus marcas y su sub-etapa—: deja sus OTs a un clic en todas las pestañas.
  const [loteActivo, setLoteActivo] = useState<LoteProduccion | null>(null);

  const { ot: otCargada, loading: cargandoOT, refrescar } = useOTPorNumero(ot);
  const { areasListas, sincronizar, refrescar: refrescarAreas } = useAvanceSubEtapa(ot);

  /** Al cerrar un área: recalcular la sub-etapa y refrescar la ficha de la OT. */
  const alCerrarArea = async () => {
    await sincronizar();
    await refrescarAreas();
    await refrescar();
  };

  const tick = (area: AreaProduccion) =>
    areasListas[area] ? <span className="text-emerald-400">✓</span> : null;

  /** Desde la cola: la OT queda cargada y se cae en la primera área del taller. */
  const abrirOT = (numeroOt: string) => {
    setOt(numeroOt);
    setTab('estructura');
  };

  /** «Trabajar el lote»: se fija la barra y se entra por su primera OT. */
  const trabajarLote = (lote: LoteProduccion) => {
    setLoteActivo(lote);
    const primera = lote.ots[0];
    if (primera) setOt(primera.numeroOt);
    setTab('estructura');
  };

  return (
    <div className="mx-auto max-w-7xl p-4">
      <header className="mb-4 flex items-center gap-2">
        <Wrench className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Producción</h1>
          <p className="text-xs text-muted-foreground">
            Estructura y paños en paralelo · dimensionado · armado · prueba
          </p>
        </div>
      </header>

      <BandejaAvisos />

      {/* Buscar desde la portada también saca de ella: si alguien escribió una
          OT es porque quiere trabajarla, no seguir mirando la cola. */}
      <BuscadorOT
        ot={ot}
        onBuscar={(numero) => {
          setOt(numero);
          if (tab === 'cola') setTab('estructura');
        }}
        otCargada={otCargada}
        loading={cargandoOT}
      />

      {loteActivo && (
        <BarraLote
          nombre={loteActivo.nombre}
          ots={loteActivo.ots}
          otActual={ot}
          onElegir={(numeroOt) => {
            setOt(numeroOt);
            if (tab === 'cola') setTab('estructura');
          }}
          onSalir={() => setLoteActivo(null)}
        />
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
        <TabButton active={tab === 'cola'} onClick={() => setTab('cola')}>
          <ListChecks className="h-4 w-4" />
          Cola
        </TabButton>
        <TabButton
          active={tab === 'estructura'}
          onClick={() => setTab('estructura')}
          badge={tick('estructura')}
        >
          <Hammer className="h-4 w-4" />
          Estructura
        </TabButton>
        <TabButton active={tab === 'panos'} onClick={() => setTab('panos')} badge={tick('panos')}>
          <Scissors className="h-4 w-4" />
          Paños
        </TabButton>
        <TabButton
          active={tab === 'dimensionado'}
          onClick={() => setTab('dimensionado')}
          badge={tick('dimensionado')}
        >
          <Ruler className="h-4 w-4" />
          Dimensionado
        </TabButton>
        <TabButton active={tab === 'armado'} onClick={() => setTab('armado')} badge={tick('armado')}>
          <Wrench className="h-4 w-4" />
          Armado
        </TabButton>
        <TabButton active={tab === 'prueba'} onClick={() => setTab('prueba')} badge={tick('prueba')}>
          <ClipboardCheck className="h-4 w-4" />
          Prueba
        </TabButton>
        <TabButton active={tab === 'bodega'} onClick={() => setTab('bodega')}>
          <Boxes className="h-4 w-4" />
          Inventario
        </TabButton>
        {admin && (
          <TabButton active={tab === 'costo'} onClick={() => setTab('costo')}>
            <DollarSign className="h-4 w-4" />
            Costo total
          </TabButton>
        )}
      </div>

      {tab === 'cola' && (
        <VistaCola
          admin={admin}
          onAbrirOT={abrirOT}
          onTrabajarLote={trabajarLote}
          loteActivoId={loteActivo?.id ?? null}
          onLoteEliminado={(id) => setLoteActivo((l) => (l?.id === id ? null : l))}
        />
      )}
      {tab === 'estructura' && <VistaEstructura ot={ot} onAreaCerrada={alCerrarArea} />}
      {tab === 'panos' && (
        <VistaPanos ot={ot} otCargada={otCargada} onAreaCerrada={alCerrarArea} />
      )}
      {tab === 'dimensionado' && (
        <VistaCalculo
          area="dimensionado"
          ot={ot}
          otCargada={otCargada}
          areasListas={areasListas}
          onAreaCerrada={alCerrarArea}
          lote={loteActivo}
        />
      )}
      {tab === 'armado' && (
        <VistaCalculo
          area="armado"
          ot={ot}
          otCargada={otCargada}
          areasListas={areasListas}
          onAreaCerrada={alCerrarArea}
        />
      )}
      {tab === 'prueba' && (
        <VistaPrueba ot={ot} otCargada={otCargada} onAreaCerrada={alCerrarArea} />
      )}
      {tab === 'bodega' && <VistaInventario ot={ot} otCargada={otCargada} />}
      {/* El `admin` no es decorativo: si no lo es, la pantalla no se monta y
          los costos ni siquiera se consultan. */}
      {tab === 'costo' && admin && <VistaCosto ot={ot} otCargada={otCargada} />}
    </div>
  );
}
