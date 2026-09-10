// Auditoría: quién tocó qué. Es la misma tabla que muestra Admin, acá dentro
// del módulo para no tener que salir a buscarla cuando un saldo no cuadra.

import { PageHeader } from '@/components/ui/page-header';
import { AuditLogSection } from '@/components/admin/AuditLogSection';

export function VistaAuditoria() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        miga="Inventario"
        titulo="Auditoría"
        hint="Cada cambio guardado en insumos, tubos, paños y materiales de OT, con quién lo hizo y qué había antes."
      />
      <AuditLogSection />
    </div>
  );
}

export default VistaAuditoria;
