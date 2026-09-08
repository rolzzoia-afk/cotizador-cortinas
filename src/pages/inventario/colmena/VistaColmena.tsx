// Colmena de paños: los retazos de tela que sobran de cada corte, dibujados
// como el rack físico del galpón (lámina «Colmena de paños»).
//
// La grilla y el panel del paño son los mismos de siempre (ColmenaVivaTab): acá
// solo se les pone el encabezado del módulo y se les carga la data.

import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { DIAS_ALERTA, enAlerta } from '@/modules/telas/colmenaViva';
import { useDatosTelas } from '@/modules/inventario/telasStore';
import ColmenaVivaTab from '../telas/tabs/ColmenaVivaTab';

export function VistaColmena() {
  const { panos, fallas, loading, error, recargar } = useDatosTelas({ incluirPanos: true });

  const hoyISO = new Date().toISOString();
  const disponibles = panos.filter((p) => p.disponible && !p.datos_extra?.baja);
  const enAlertaCant = disponibles.filter((p) => enAlerta(p, hoyISO)).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Colmena de paños"
        hint={
          loading
            ? 'Cargando…'
            : `${disponibles.length.toLocaleString('es-CL')} paños disponibles · ${enAlertaCant.toLocaleString('es-CL')} llevan más de ${DIAS_ALERTA} días sin usarse`
        }
      />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/[0.09] px-4 py-3 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <ColmenaVivaTab panos={panos} fallas={fallas} onReload={recargar} />
      )}
    </div>
  );
}

export default VistaColmena;
