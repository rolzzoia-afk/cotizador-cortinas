// Admin → Catálogo técnico.
//
// Todo lo que define cómo se fabrica una cortina: los descuentos de despiece
// por modelo (editables), las fórmulas de cada tipo en cuadros, y con qué
// criterio la app elige tubo y mecanismo.
//
// Antes esto solo existía en el Excel maestro y en el código: para cambiar un
// centímetro había que subir una planilla que reemplazaba todo, o publicar una
// versión nueva de la app.

import { ProbadorCortinaSection } from '@/components/admin/catalogo/ProbadorCortinaSection';
import { ModelosCatalogoSection } from '@/components/admin/catalogo/ModelosCatalogoSection';
import { CuadrosFormulasSection } from '@/components/admin/catalogo/CuadrosFormulasSection';
import { SeleccionCatalogoSection } from '@/components/admin/catalogo/SeleccionCatalogoSection';
import { TiposCortinaSection } from '@/components/admin/catalogo/TiposCortinaSection';
import { DescuentosCatalogoSection } from '@/components/admin/DescuentosCatalogoSection';

export default function VistaCatalogo() {
  return (
    <div className="space-y-6">
      {/* Primero el banco de pruebas: lo que sigue se comprueba acá mismo. */}
      <ProbadorCortinaSection />
      <ModelosCatalogoSection />
      <CuadrosFormulasSection />
      <TiposCortinaSection />
      <SeleccionCatalogoSection />
      <DescuentosCatalogoSection />
    </div>
  );
}
