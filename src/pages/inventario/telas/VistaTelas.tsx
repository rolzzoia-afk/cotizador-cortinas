// Catálogo de telas: el saldo en metros de cada código y sus fallas.
//
// Los movimientos, las mermas y la colmena de paños salieron de acá y son
// submódulos propios; la lectura la comparten todos por `telasStore`, que ya no
// trae los más de 2.000 paños salvo que se los pidan.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Boxes, Loader2, PencilRuler } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { useAuth } from '@/lib/auth';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import CatalogoTab from './tabs/CatalogoTab';
import FallasTab from './tabs/FallasTab';
import { useInventario } from '../InventarioLayout';

type Pestana = 'catalogo' | 'fallas';

export function Telas() {
  const { empresaId } = useAuth();
  const { queryRol } = useInventario();
  const [tab, setTab] = useState<Pestana>('catalogo');
  const { telas, fallas, validadores, colmena, loading, error, recargar } = useDatosTelas();

  const fallasPendientes = useMemo(
    () => fallas.filter((f) => f.resuelto === 'NO').length,
    [fallas],
  );
  const conStock = useMemo(
    () => telas.filter((t) => (t.stock_mp || 0) + (t.stock_liberado || 0) > 0).length,
    [telas],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Telas"
        hint={
          loading
            ? 'Cargando…'
            : `${telas.length.toLocaleString('es-CL')} códigos · ${conStock.toLocaleString('es-CL')} con stock · el saldo se lleva en metros`
        }
      />

      {/* Movimientos, mermas y la colmena de paños ahora son submódulos
          propios: acá quedan el catálogo y las fallas, que son de la tela. */}
      <div className="flex items-center gap-5 overflow-x-auto border-b border-border">
        <TabButton
          variante="subrayado"
          active={tab === 'catalogo'}
          onClick={() => setTab('catalogo')}
        >
          <Boxes className="h-4 w-4" /> Catálogo
        </TabButton>
        <TabButton
          variante="subrayado"
          active={tab === 'fallas'}
          onClick={() => setTab('fallas')}
          badge={
            fallasPendientes > 0 ? (
              <Badge variant="destructive">{fallasPendientes}</Badge>
            ) : undefined
          }
        >
          <AlertTriangle className="h-4 w-4" /> Fallas
        </TabButton>
        <Link
          to="/inventario/colmena"
          className="flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 py-2.5 text-[0.845rem] font-medium text-muted-foreground hover:text-foreground"
        >
          <PencilRuler className="h-4 w-4" /> Colmena de paños
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : tab === 'catalogo' ? (
        <CatalogoTab
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={recargar}
          colmena={colmena}
          rutaFicha={(codigo) => `/inventario/telas/${encodeURIComponent(codigo)}${queryRol}`}
        />
      ) : (
        <FallasTab
          fallas={fallas}
          telas={telas}
          validadores={validadores}
          empresaId={empresaId || ''}
          onReload={recargar}
        />
      )}
    </div>
  );
}

export default Telas;
