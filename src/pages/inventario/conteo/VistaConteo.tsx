// Conteo físico. Hoy el único dominio que se cuenta con red de seguridad es el
// de los tubos: tiene snapshot, diferencia y cierre con firma.
//
// El conteo de insumos y el de telas llegan en la Entrega C, con tablas
// PROPIAS. No se puede reusar `inventarios`: mientras hay uno activo,
// `sync_colmena_tubos` se bloquea, así que contar tornillos dejaría al taller
// sin poder cortar.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { TabButton } from '@/components/ui/tab-button';
import { esRolAdmin } from '@/lib/roles';
import { ConteoTubosAdmin } from './ConteoTubosAdmin';
import { useInventario } from '../InventarioLayout';

type Pestana = 'tubos' | 'insumos' | 'telas';

export function VistaConteo() {
  const { rol, queryRol, resumen } = useInventario();
  const [pestana, setPestana] = useState<Pestana>('tubos');
  const admin = esRolAdmin(rol);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Conteo físico"
        hint="Dos personas cuentan sin verse. El sistema compara y solo se ajusta lo que no calza."
      />

      <div className="flex items-center gap-5 border-b border-border">
        <TabButton
          variante="subrayado"
          active={pestana === 'tubos'}
          onClick={() => setPestana('tubos')}
          badge={resumen.conteoActivo ? <Badge variant="accent">Activo</Badge> : undefined}
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
        <TabButton
          variante="subrayado"
          active={pestana === 'telas'}
          onClick={() => setPestana('telas')}
        >
          Telas
        </TabButton>
      </div>

      {pestana === 'tubos' ? (
        admin ? (
          <ConteoTubosAdmin />
        ) : (
          <EmptyState
            titulo={
              resumen.conteoActivo ? 'Hay un conteo abierto' : 'No hay ningún conteo abierto'
            }
            texto={
              resumen.conteoActivo
                ? 'Abrí la pantalla de contar para registrar lo que vas contando. Nadie ve tus números hasta que se cierre.'
                : 'Cuando un administrador abra un conteo, vas a poder registrar acá lo que cuentes.'
            }
            accion={
              resumen.conteoActivo ? (
                <Link
                  to={`/inventario/conteo/contar${queryRol}`}
                  className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[0.845rem] font-medium text-accent-foreground"
                >
                  Ir a contar
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <EmptyState
          titulo={`El conteo de ${pestana} llega en la próxima entrega`}
          texto="Va a funcionar igual que el de tubos: se congela lo que se cuenta, dos personas cuentan por separado y al cerrar se ajusta solo lo que no calza, con firma."
        />
      )}
    </div>
  );
}

export default VistaConteo;
