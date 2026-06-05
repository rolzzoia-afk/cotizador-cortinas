// Orquestador de la pestaña "Correcciones" dentro de Ojo de Dios.
//
// Llama los 5 hooks de datos del módulo admin y compone las secciones
// hijas. Toda la lógica de cada sección vive en su archivo propio bajo
// ./correcciones/.

import { useEffect } from 'react';
import {
  useCorreccionesHistorial,
  useOptimizerConfig,
  usePlanActivo,
  usePlanesHistorial,
  useSaludColmena,
} from '@/modules/admin/correcciones';

import SaludColmenaWidget from './correcciones/SaludColmenaWidget';
import ConfigOptimizador from './correcciones/ConfigOptimizador';
import PlanActivoSection from './correcciones/PlanActivoSection';
import CorreccionRetroactivaSection from './correcciones/CorreccionRetroactivaSection';
import HistorialCorrecciones from './correcciones/HistorialCorrecciones';
import HistorialPlanes from './correcciones/HistorialPlanes';
import HintColmenaDuplicada from './correcciones/HintColmenaDuplicada';

export function Correcciones() {
  const cfg = useOptimizerConfig();
  const planActivo = usePlanActivo();
  const historial = useCorreccionesHistorial();
  const planes = usePlanesHistorial();
  const salud = useSaludColmena();

  // Auto-cargar al montar si ya hay email configurado
  useEffect(() => {
    if (cfg.email) {
      planActivo.cargar();
      historial.cargar();
      planes.cargar();
      salud.verificar().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.email]);

  return (
    <div className="space-y-3">
      <SaludColmenaWidget salud={salud} />
      <ConfigOptimizador cfg={cfg} />
      <PlanActivoSection ctx={planActivo} />
      <CorreccionRetroactivaSection
        planes={planes}
        onAplicado={() => {
          historial.cargar();
          salud.verificar().catch(() => undefined);
        }}
      />
      <HistorialCorrecciones ctx={historial} />
      <HistorialPlanes ctx={planes} email={cfg.email} />
      <HintColmenaDuplicada />
    </div>
  );
}
