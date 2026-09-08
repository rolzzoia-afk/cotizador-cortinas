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
import { Link } from 'react-router-dom';
import { Clock, Grid3x3, Link2, Ruler, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PageHeader } from '@/components/ui/page-header';

import TabButton from './components/TabButton';
import VistaColmena from './vistas/VistaColmena';
import VistaTrazabilidad from './vistas/VistaTrazabilidad';
import VistaHistorial from './vistas/VistaHistorial';
import VistaMerma from './vistas/VistaMerma';

type Tab = 'colmena' | 'trazabilidad' | 'historial' | 'merma';

export function HistorialTubos() {
  const { empresaId } = useAuth();
  const [tab, setTab] = useState<Tab>('colmena');

  return (
    <div className={tab === 'colmena' ? 'max-w-7xl' : 'max-w-5xl'}>
      <PageHeader
        miga="Inventario"
        titulo="Tubos"
        hint="Cada tubo es una pieza con su largo y su historia."
        acciones={
          <Link
            to="/optimizador"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[0.845rem] font-medium text-background"
          >
            <Ruler className="h-4 w-4" />
            Abrir optimizador de corte
          </Link>
        }
      />

      <div className="mt-4 rounded-lg border border-accent/35 bg-accent/[0.09] px-4 py-3 text-xs leading-relaxed">
        El <b className="font-semibold">optimizador de corte no se toca</b>: sigue siendo la
        pantalla de siempre y es el único que escribe los tubos. Acá se mira, se busca y se
        corrige a mano.
      </div>

      <div className="mb-4 mt-4 flex gap-1 border-b">
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
