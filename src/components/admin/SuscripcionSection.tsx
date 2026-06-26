// ─────────────────────────────────────────────────────────────────────
// Admin → Suscripción
//
// Muestra el plan y el estado de la suscripción de la empresa. Mientras
// no haya pasarela de pago, la activación es manual: el proveedor del
// sistema fija `tenants.activo_hasta` cuando recibe el pago. Cuando se
// integre MercadoPago/Transbank/Stripe, el pago actualizará ese mismo
// campo y esta pantalla no cambia.
// ─────────────────────────────────────────────────────────────────────
import { CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const NOMBRE_PLAN: Record<string, string> = {
  trial: 'Período de prueba',
  basico: 'Plan Básico',
  pro: 'Plan Pro',
};

export function SuscripcionSection() {
  const { suscripcion } = useAuth();
  if (!suscripcion) return null;

  const plan = NOMBRE_PLAN[suscripcion.plan ?? ''] ?? suscripcion.plan ?? '—';
  const dias = suscripcion.dias_restantes ?? 0;
  const venceStr = suscripcion.vence
    ? new Date(suscripcion.vence).toLocaleDateString('es-CL')
    : null;
  const porVencer = !suscripcion.exenta && suscripcion.activa && dias <= 7;

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Suscripción</h2>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
          {plan}
        </span>
        {suscripcion.exenta ? (
          <span className="text-muted-foreground">Empresa exenta de cobro.</span>
        ) : suscripcion.activa ? (
          <span className={porVencer ? 'font-medium text-warning' : 'text-muted-foreground'}>
            {suscripcion.en_trial ? 'Prueba gratis' : 'Activa'} hasta el {venceStr} ({dias}{' '}
            {dias === 1 ? 'día' : 'días'} restantes)
          </span>
        ) : (
          <span className="font-medium text-destructive">Vencida</span>
        )}
      </div>

      {!suscripcion.exenta && (
        <p className="mt-3 text-xs text-muted-foreground">
          {porVencer && '⚠ Tu acceso vence pronto. '}
          Para activar o renovar tu plan, contáctanos y lo dejamos activo al instante. El pago
          en línea estará disponible próximamente.
        </p>
      )}
    </section>
  );
}
