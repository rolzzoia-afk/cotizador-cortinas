// Orquestador de la pantalla "Tubos".
//
// Es una pantalla de consulta de solo lectura con 4 pestañas que viven
// cada una en su propio archivo bajo ./historial-tubos/vistas/. Esta página
// solo decide qué tab mostrar y le pasa empresaId — todo lo demás (queries,
// componentes hijos, helpers) está modularizado.
//
// La pestaña Colmena va primera y es el default: es la vista de trabajo
// (qué hay en cada ubicación, en vivo); el resto son consultas puntuales.

import { useState } from 'react';
import { Clock, Grid3x3, Link2, Ruler, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

import TabButton from './historial-tubos/components/TabButton';
import VistaColmena from './historial-tubos/vistas/VistaColmena';
import VistaTrazabilidad from './historial-tubos/vistas/VistaTrazabilidad';
import VistaHistorial from './historial-tubos/vistas/VistaHistorial';
import VistaMerma from './historial-tubos/vistas/VistaMerma';

type Tab = 'colmena' | 'trazabilidad' | 'historial' | 'merma';

export function HistorialTubos() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState<Tab>('colmena');

  return (
    <div className={`mx-auto p-4 ${tab === 'colmena' ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <header className="mb-4 flex items-center gap-2">
        <Ruler className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-bold">Tubos</h1>
          <p className="text-xs text-muted-foreground">
            Colmena · Trazabilidad · Merma mensual
          </p>
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b">
        <TabButton active={tab === 'colmena'} onClick={() => setTab('colmena')}>
          <Grid3x3 className="h-4 w-4" />
          Colmena
        </TabButton>
        <TabButton active={tab === 'trazabilidad'} onClick={() => setTab('trazabilidad')}>
          <Link2 className="h-4 w-4" />
          Trazabilidad
        </TabButton>
        <TabButton active={tab === 'historial'} onClick={() => setTab('historial')}>
          <Clock className="h-4 w-4" />
          Historial técnico
        </TabButton>
        <TabButton active={tab === 'merma'} onClick={() => setTab('merma')}>
          <Trash2 className="h-4 w-4" />
          Merma mensual
        </TabButton>
      </div>

      {tab === 'colmena' && <VistaColmena empresaId={empresaId} />}
      {tab === 'trazabilidad' && <VistaTrazabilidad empresaId={empresaId} />}
      {tab === 'historial' && <VistaHistorial empresaId={empresaId} />}
      {tab === 'merma' && <VistaMerma empresaId={empresaId} />}
    </div>
  );
}
