// Tubos de aluminio (lámina «Tubos de aluminio»).
//
// Cada tubo es una PIEZA con su largo y su historia: no hay saldo que sumar,
// hay 566 barras cortadas de distinto porte. Por eso la pantalla es un mapa de
// estantes y una ficha, no una tabla de cantidades.
//
// El optimizador de corte no se toca: sigue siendo la pantalla de siempre y es
// el único que escribe los tubos. Acá se mira, se busca y se corrige a mano.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileUp, Grid3x3, Link2, Ruler, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { useAuth } from '@/lib/auth';
import type { TuboColmena } from '@/modules/tubos/colmenaTubos';
import CargaBaseDialog from './dialogs/CargaBaseDialog';
import VistaColmena from './vistas/VistaColmena';
import VistaTrazabilidad, { type BusquedaInicial } from './vistas/VistaTrazabilidad';
import VistaHistorial from './vistas/VistaHistorial';
import VistaMerma from './vistas/VistaMerma';
import { useInventario } from '../InventarioLayout';

type Tab = 'colmena' | 'trazabilidad' | 'historial' | 'merma';

export function HistorialTubos() {
  const { empresaId } = useAuth();
  const { rol } = useInventario();
  const [tab, setTab] = useState<Tab>('colmena');
  const [cargaBase, setCargaBase] = useState(false);
  const [resumen, setResumen] = useState<{ tubos: number; metros: number } | null>(null);
  const [inicial, setInicial] = useState<BusquedaInicial | null>(null);

  // «Ver historial» de una pieza: la ficha completa —de qué barra salió y qué
  // sobrantes dejó— vive en Trazabilidad, así que se salta con la búsqueda
  // ya escrita en vez de pedirle a alguien que la reescriba.
  const verHistorial = (t: TuboColmena) => {
    setInicial({
      cod: t.cod || '',
      colmena: t.n_colmena || '',
      medida: t.medida_cm != null ? String(t.medida_cm) : '',
    });
    setTab('trazabilidad');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        miga="Inventario"
        titulo="Tubos de aluminio"
        hint={
          resumen
            ? `${resumen.tubos.toLocaleString('es-CL')} tubos en colmena · ${resumen.metros.toLocaleString('es-CL', { maximumFractionDigits: 0 })} m lineales · cada tubo es una pieza con su largo y su historia`
            : 'Cada tubo es una pieza con su largo y su historia'
        }
        acciones={
          <>
            {rol === 'admin' && (
              <Button variant="outline" onClick={() => setCargaBase(true)}>
                <FileUp className="h-4 w-4" />
                Carga base
              </Button>
            )}
            <Link
              to="/optimizador"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[0.845rem] font-medium text-background"
            >
              <Ruler className="h-4 w-4" />
              Abrir optimizador de corte
            </Link>
          </>
        }
      />

      <div className="rounded-lg border border-accent/35 bg-accent/[0.09] px-4 py-3 text-xs leading-relaxed">
        El <b className="font-semibold">optimizador de corte no se toca</b>: sigue siendo la
        pantalla de siempre y es el único que escribe los tubos. Acá se mira, se busca y se corrige
        a mano.
      </div>

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={tab === 'colmena'}
          onClick={() => setTab('colmena')}
          badge={
            resumen ? (
              <Badge variant={tab === 'colmena' ? 'accent' : 'muted'}>{resumen.tubos}</Badge>
            ) : undefined
          }
        >
          <Grid3x3 className="h-4 w-4" /> Colmena
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'trazabilidad'}
          onClick={() => setTab('trazabilidad')}
        >
          <Link2 className="h-4 w-4" /> Trazabilidad
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'historial'}
          onClick={() => setTab('historial')}
        >
          <Clock className="h-4 w-4" /> Historial
        </TabButton>
        <TabButton variante="subrayado" active={tab === 'merma'} onClick={() => setTab('merma')}>
          <Trash2 className="h-4 w-4" /> Merma
        </TabButton>
      </div>

      {/* La colmena se mantiene MONTADA: es la que tiene el canal en vivo y el
          tubo elegido, y desmontarla al ir a Trazabilidad haría reconectar y
          perder la pieza que se estaba mirando. */}
      <div className={tab === 'colmena' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <VistaColmena
          empresaId={empresaId}
          onResumen={setResumen}
          onVerHistorial={verHistorial}
        />
      </div>
      {tab === 'trazabilidad' && <VistaTrazabilidad empresaId={empresaId} inicial={inicial} />}
      {tab === 'historial' && <VistaHistorial empresaId={empresaId} />}
      {tab === 'merma' && <VistaMerma empresaId={empresaId} />}

      {cargaBase && <CargaBaseDialog onClose={() => setCargaBase(false)} />}
    </div>
  );
}

export default HistorialTubos;
