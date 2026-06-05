// Sección "Contacto" del LeadDetalleDialog: muestra WhatsApp, email, RUT,
// comuna, fuente, presupuesto, vendedora asignada y comentarios libres.

import { FileText, Mail, MapPin, Phone, User } from 'lucide-react';
import type { Lead } from '@/modules/leads/types';

interface ContactoSectionProps {
  lead: Lead;
  vendedoraNombre: string | null;
}

export default function ContactoSection({ lead, vendedoraNombre }: ContactoSectionProps) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contacto</div>
      <div className="grid gap-1.5 text-sm">
        {lead.whatsapp_phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <a
              href={`https://wa.me/${lead.whatsapp_phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="text-foreground hover:text-accent"
            >
              {lead.whatsapp_phone}
            </a>
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={`mailto:${lead.email}`} className="text-foreground hover:text-accent">
              {lead.email}
            </a>
          </div>
        )}
        {lead.rut && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{lead.rut}</span>
          </div>
        )}
        {lead.comuna && (
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{lead.comuna}</span>
          </div>
        )}
        {lead.fuente && (
          <div className="text-xs text-muted-foreground">
            Fuente: <span className="text-foreground">{lead.fuente}</span>
          </div>
        )}
        {lead.presupuesto_rango && (
          <div className="text-xs text-muted-foreground">
            Presupuesto:{' '}
            <span className="font-semibold text-foreground">{lead.presupuesto_rango}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground">
          Vendedora: <span className="text-foreground">{vendedoraNombre || 'Sin asignar'}</span>
        </div>
      </div>
      {lead.comentarios && (
        <div className="mt-2 rounded border border-border bg-background/40 p-2 text-xs text-muted-foreground">
          <FileText className="mr-1 inline h-3 w-3" />
          {lead.comentarios}
        </div>
      )}
    </section>
  );
}
