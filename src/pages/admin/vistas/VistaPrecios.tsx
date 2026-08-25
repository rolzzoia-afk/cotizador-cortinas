// Admin → Precios.
//
// Todo lo que define cuánto sale una cortina: los precios de insumo, la lista
// de materiales de cada familia, la tela con la que se cobra cada gama y los
// valores comerciales (mano de obra, traslado, instalación, IVA, tarjeta).
//
// Es el equivalente de ventas del Catálogo técnico: aquello dice cómo se
// FABRICA una cortina, esto dice cuánto CUESTA. Antes esta mitad solo existía
// dentro del código y en el Excel de las vendedoras.

import { useState } from 'react';
import { Blinds, Coins, FlaskConical, Package, Scroll } from 'lucide-react';
import TabButton from '@/pages/historial-tubos/components/TabButton';
import {
  ReglasPreciosSection,
  type TabPrecios,
} from '@/components/admin/precios/ReglasPreciosSection';
import { ProductosCatalogoSection } from '@/components/admin/precios/ProductosCatalogoSection';
import { ParametrosCotizadorSection } from '@/components/admin/ParametrosCotizadorSection';
import { ComisionesTarjetaSection } from '@/components/admin/ComisionesTarjetaSection';

// Las cuatro hojas del Excel manual, en el orden en que se usan: se prueba un
// precio, se revisan los materiales, se mira la tela y al final los valores
// comerciales. Antes era una sola página larguísima donde había que buscar.
const TABS: Array<{ id: TabPrecios; label: string; icon: typeof Coins }> = [
  { id: 'probador', label: 'Probador', icon: FlaskConical },
  { id: 'insumos', label: 'Insumos', icon: Package },
  { id: 'recetas', label: 'Recetas y sistemas', icon: Scroll },
  { id: 'telas', label: 'Catálogo de telas', icon: Blinds },
  { id: 'comercial', label: 'Valores comerciales', icon: Coins },
];

export default function VistaPrecios() {
  const [tab, setTab] = useState<TabPrecios>('probador');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabButton>
        ))}
      </div>

      {/* Se queda montada en TODAS las pestañas aunque no dibuje nada: es la
          dueña del borrador, y desmontarla se llevaría los cambios sin guardar
          al cambiar de pestaña. */}
      <ReglasPreciosSection tab={tab} />

      {/* El catálogo y los parámetros guardan solos, sin pasar por ese borrador. */}
      {tab === 'telas' && <ProductosCatalogoSection />}
      {tab === 'comercial' && (
        <>
          <ParametrosCotizadorSection />
          <ComisionesTarjetaSection />
        </>
      )}
    </div>
  );
}
