// Mermas y fallas: lo que se perdió y lo que llegó malo, en un solo lugar.
//
// Junta tres listas que hasta ahora vivían en pantallas distintas: las mermas
// de tela, las fallas de rollo y la merma de tubos del taller.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { useAuth } from '@/lib/auth';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import MermasTab from '../telas/tabs/MermasTab';
import FallasTab from '../telas/tabs/FallasTab';
import VistaMermaTubos from '../tubos/vistas/VistaMerma';

type Pestana = 'telas' | 'fallas' | 'tubos' | 'insumos';

export function VistaMermas() {
  const { empresaId } = useAuth();
  const [pestana, setPestana] = useState<Pestana>('telas');
  const { telas, fallas, mermas, validadores, loading, error, recargar } = useDatosTelas();

  const fallasPendientes = fallas.filter((f) => f.resuelto === 'NO').length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Mermas y fallas"
        hint={
          loading
            ? 'Cargando…'
            : `${mermas.length} mermas de tela · ${fallasPendientes} fallas sin resolver`
        }
      />

      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={pestana === 'telas'}
          onClick={() => setPestana('telas')}
          badge={<Badge variant="muted">{mermas.length}</Badge>}
        >
          Telas
        </TabButton>
        <TabButton
          variante="subrayado"
          active={pestana === 'fallas'}
          onClick={() => setPestana('fallas')}
          badge={
            fallasPendientes > 0 ? (
              <Badge variant="destructive">{fallasPendientes}</Badge>
            ) : undefined
          }
        >
          Fallas de tela
        </TabButton>
        <TabButton
          variante="subrayado"
          active={pestana === 'tubos'}
          onClick={() => setPestana('tubos')}
        >
          Tubos
        </TabButton>
        <TabButton
          variante="subrayado"
          active={pestana === 'insumos'}
          onClick={() => setPestana('insumos')}
        >
          Insumos
        </TabButton>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : loading && pestana !== 'tubos' ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : pestana === 'telas' ? (
        <MermasTab mermas={mermas} />
      ) : pestana === 'fallas' ? (
        <FallasTab
          fallas={fallas}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={recargar}
        />
      ) : pestana === 'tubos' ? (
        <VistaMermaTubos empresaId={empresaId || ''} />
      ) : (
        <EmptyState
          titulo="La merma de insumos llega con el kardex"
          texto="Hoy un insumo que se rompe se corrige con un ajuste. Cuando el kardex esté en marcha, la merma va a ser su propio tipo de movimiento y se va a poder mirar acá."
        />
      )}
    </div>
  );
}

export default VistaMermas;
