import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Paso = 1 | 2 | 3;

type TamanoEquipo = '1-3' | '4-10' | '10+';

type Canal = {
  id: string;
  label: string;
};

const CANALES: Canal[] = [
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'facebook', label: '📘 Facebook' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'local', label: '🏪 Local físico' },
  { id: 'web', label: '🌐 Sitio web' },
  { id: 'referidos', label: '🤝 Referidos' },
];

export function Setup() {
  const navigate = useNavigate();
  const { empresaId, refresh } = useAuth();

  const [paso, setPaso] = useState<Paso>(1);
  const [saving, setSaving] = useState(false);

  const [equipo, setEquipo] = useState('');
  const [personas, setPersonas] = useState<TamanoEquipo>('1-3');
  const [canales, setCanales] = useState<Set<string>>(new Set());
  const [metaCotz, setMetaCotz] = useState('');
  const [metaCierres, setMetaCierres] = useState('');

  const toggleCanal = (id: string) => {
    setCanales((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finalizar = async () => {
    if (!empresaId) {
      toast.error('No se pudo resolver tu empresa. Recargá la página.');
      return;
    }
    setSaving(true);

    const configs = [
      { empresa_id: empresaId, clave: 'equipo_nombre', valor: equipo.trim() || 'Mi equipo' },
      { empresa_id: empresaId, clave: 'equipo_tamano', valor: personas },
      { empresa_id: empresaId, clave: 'canales_venta', valor: JSON.stringify([...canales]) },
      {
        empresa_id: empresaId,
        clave: 'meta_cotizaciones',
        valor: String(parseInt(metaCotz, 10) || 30),
      },
      {
        empresa_id: empresaId,
        clave: 'meta_cierres',
        valor: String(parseInt(metaCierres, 10) || 10),
      },
      { empresa_id: empresaId, clave: 'onboarding_completado', valor: 'true' },
    ];

    try {
      for (const c of configs) {
        const { error } = await supabase
          .from('configuracion')
          .upsert(c, { onConflict: 'empresa_id,clave' });
        if (error) throw error;
      }
      await refresh();
      navigate('/', { replace: true });
    } catch (e) {
      toast.error('Error guardando configuración: ' + (e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Settings2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Configuración inicial</CardTitle>
          <CardDescription>Configurá lo básico para empezar a usar Rolzzo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Indicador de pasos */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-all',
                  n === paso && 'scale-125 bg-primary',
                  n < paso && 'bg-green-500',
                  n > paso && 'bg-muted',
                )}
              />
            ))}
          </div>

          {paso === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="equipo">Nombre del equipo o sucursal</Label>
                <Input
                  id="equipo"
                  placeholder="Ej: Taller Central, Sucursal Norte…"
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="personas">¿Cuántas personas van a usar el sistema?</Label>
                <select
                  id="personas"
                  value={personas}
                  onChange={(e) => setPersonas(e.target.value as TamanoEquipo)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="1-3">1 a 3 personas</option>
                  <option value="4-10">4 a 10 personas</option>
                  <option value="10+">Más de 10</option>
                </select>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setPaso(2)}>Siguiente</Button>
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <Label>¿Qué canales de venta usás? (seleccioná los que apliquen)</Label>
              <div className="grid grid-cols-2 gap-2">
                {CANALES.map((c) => {
                  const selected = canales.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCanal(c.id)}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 font-semibold text-primary'
                          : 'border-input bg-background text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setPaso(1)}>
                  Atrás
                </Button>
                <Button onClick={() => setPaso(3)}>Siguiente</Button>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="meta-cotz">Meta mensual de cotizaciones</Label>
                <Input
                  id="meta-cotz"
                  type="number"
                  min={0}
                  placeholder="Ej: 50"
                  value={metaCotz}
                  onChange={(e) => setMetaCotz(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta-cierres">Meta mensual de cierres (ventas)</Label>
                <Input
                  id="meta-cierres"
                  type="number"
                  min={0}
                  placeholder="Ej: 15"
                  value={metaCierres}
                  onChange={(e) => setMetaCierres(e.target.value)}
                />
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setPaso(2)} disabled={saving}>
                  Atrás
                </Button>
                <Button onClick={finalizar} disabled={saving}>
                  {saving ? 'Guardando…' : 'Empezar a usar Rolzzo'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
