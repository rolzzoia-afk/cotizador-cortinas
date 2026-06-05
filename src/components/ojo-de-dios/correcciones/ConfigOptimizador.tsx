// Formulario chico para configurar el email del optimizador de estructura
// (lo usan los hooks del módulo admin para saber a quién atribuir las
// correcciones).

import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type useOptimizerConfig } from '@/modules/admin/correcciones';

interface ConfigOptimizadorProps {
  cfg: ReturnType<typeof useOptimizerConfig>;
}

export default function ConfigOptimizador({ cfg }: ConfigOptimizadorProps) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(cfg.email);
  }, [cfg.email]);

  const guardar = async () => {
    setSaving(true);
    try {
      await cfg.guardar(draft);
      toast.success('Email del optimizador guardado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error('Error: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-warning/30 bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Settings className="h-4 w-4 text-warning" />
        <strong className="text-sm">Configuración del optimizador</strong>
      </div>
      <div className="flex gap-2">
        <Input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Email del optimizador de estructura"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          onClick={guardar}
          disabled={saving || cfg.loading}
          className="h-8 gap-1 bg-warning hover:bg-warning"
        >
          <Save className="h-3.5 w-3.5" />
          Guardar
        </Button>
      </div>
      {cfg.email && (
        <div className="mt-1 text-[0.68rem] text-muted-foreground">
          ✅ Optimizador: <span className="text-warning">{cfg.email}</span>
        </div>
      )}
    </div>
  );
}
