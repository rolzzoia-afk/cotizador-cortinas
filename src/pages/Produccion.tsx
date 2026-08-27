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
  Ruler,
  Scissors,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { esRolAdmin } from '@/lib/roles';
import { useAvanceSubEtapa, useOTPorNumero } from '@/modules/produccion/hooks';
import type { AreaProduccion } from '@/modules/produccion/types';
import BandejaAvisos from './produccion/components/BandejaAvisos';
import BuscadorOT from './produccion/components/BuscadorOT';
import TabButton from './produccion/components/TabButton';
import VistaCalculo from './produccion/vistas/VistaCalculo';
// Va con el resto y no en `lazy()` a propósito: un import dinámico acá arrastra
// el helper de precarga de Vite, que Rollup dejó dentro del chunk de jsPDF. Se
// ahorraban 18 kB y se bajaban 395.
import VistaCosto from './produccion/vistas/VistaCosto';
import VistaEstructura from './produccion/vistas/VistaEstructura';
import VistaInventario from './produccion/vistas/VistaInventario';
import VistaPanos from './produccion/vistas/VistaPanos';
import VistaPrueba from './produccion/vistas/VistaPrueba';

type Tab = AreaProduccion | 'costo';

export function Produccion() {
  const { perfil } = useAuth();
  const admin = esRolAdmin(perfil?.rol);
  const [tab, setTab] = useState<Tab>('estructura');
  const [ot, setOt] = useState('');

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

      <BuscadorOT ot={ot} onBuscar={setOt} otCargada={otCargada} loading={cargandoOT} />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b">
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
