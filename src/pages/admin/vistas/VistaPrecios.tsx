// Admin → Precios.
//
// Todo lo que define cuánto sale una cortina: los precios de insumo, la lista
// de materiales de cada familia, la tela con la que se cobra cada gama y los
// valores comerciales (mano de obra, traslado, instalación, IVA, tarjeta).
//
// Es el equivalente de ventas del Catálogo técnico: aquello dice cómo se
// FABRICA una cortina, esto dice cuánto CUESTA. Antes esta mitad solo existía
// dentro del código y en el Excel de las vendedoras.

import { ReglasPreciosSection } from '@/components/admin/precios/ReglasPreciosSection';
import { ProductosCatalogoSection } from '@/components/admin/precios/ProductosCatalogoSection';
import { ParametrosCotizadorSection } from '@/components/admin/ParametrosCotizadorSection';
import { ComisionesTarjetaSection } from '@/components/admin/ComisionesTarjetaSection';

export default function VistaPrecios() {
  return (
    <div className="space-y-6">
      {/* La contenedora abre con el probador: lo que sigue se comprueba ahí mismo. */}
      <ReglasPreciosSection />
      {/* El catálogo va aparte: guarda solo, sin pasar por el borrador de arriba. */}
      <ProductosCatalogoSection />
      <ParametrosCotizadorSection />
      <ComisionesTarjetaSection />
    </div>
  );
}
