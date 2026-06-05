// Configuración general del agente: nombre, mensaje de fuera de horario,
// mensaje fallback, max turnos sin derivar, y toggle activo/inactivo.

import { useEffect, useMemo, useState } from 'react';
import { Power, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useEmpresaAgenteConfig } from '@/modules/admin/agente-hooks';

export default function Configuracion() {
  const { config, loading, error, guardar } = useEmpresaAgenteConfig();
  const [nombre, setNombre] = useState('');
  const [mensajeFuera, setMensajeFuera] = useState('');
  const [mensajeFallback, setMensajeFallback] = useState('');
  const [maxTurnos, setMaxTurnos] = useState<number>(8);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!config) return;
    setNombre(config.nombre_agente ?? '');
    setMensajeFuera(config.mensaje_fuera_horario ?? '');
    setMensajeFallback(config.mensaje_fallback ?? '');
    setMaxTurnos(config.max_turnos_sin_derivar ?? 8);
  }, [config]);

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      nombre !== (config.nombre_agente ?? '') ||
      mensajeFuera !== (config.mensaje_fuera_horario ?? '') ||
      mensajeFallback !== (config.mensaje_fallback ?? '') ||
      maxTurnos !== (config.max_turnos_sin_derivar ?? 8)
    );
  }, [config, nombre, mensajeFuera, mensajeFallback, maxTurnos]);

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardar({
        nombre_agente: nombre.trim() || 'Diego',
        mensaje_fuera_horario: mensajeFuera,
        mensaje_fallback: mensajeFallback,
        max_turnos_sin_derivar: maxTurnos,
      });
      toast.success('Configuración guardada');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo guardar: ' + msg);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async () => {
    if (!config) return;
    try {
      await guardar({ activo: !config.activo });
      toast.success(config.activo ? 'Agente desactivado' : 'Agente activado');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      toast.error('No se pudo cambiar estado: ' + msg);
    }
  };

  if (loading && !config) {
    return <div className="text-xs text-muted-foreground">Cargando configuración…</div>;
  }

  if (error) {
    return (
      <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        Error: {error}
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded border border-warning/30 bg-warning/15 p-3 text-xs text-amber-700 dark:text-warning">
        No hay configuración de agente para esta empresa. Ejecuta el seed inicial.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 rounded-md border bg-background p-3">
        <div>
          <div className="mb-0.5 flex items-center gap-2 text-sm font-semibold">
            <Power className={cn('h-4 w-4', config.activo ? 'text-success' : 'text-muted-foreground')} />
            Estado del agente
          </div>
          <div className="text-xs text-muted-foreground">
            {config.activo
              ? 'Recibiendo y respondiendo mensajes de WhatsApp.'
              : 'Detenido. Los mensajes entrantes no se procesan.'}
          </div>
        </div>
        <Button
          variant={config.activo ? 'destructive' : 'default'}
          size="sm"
          onClick={toggleActivo}
        >
          {config.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="nombre-agente" className="text-xs">
            Nombre del agente
          </Label>
          <Input
            id="nombre-agente"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Diego"
            className="mt-1"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Aparece en cada respuesta como "Soy {nombre || 'Diego'}, asistente virtual…"
          </p>
        </div>
        <div>
          <Label htmlFor="max-turnos" className="text-xs">
            Máx. turnos sin derivar
          </Label>
          <Input
            id="max-turnos"
            type="number"
            min={3}
            max={20}
            value={maxTurnos}
            onChange={(e) => setMaxTurnos(parseInt(e.target.value) || 8)}
            className="mt-1"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            Si una conversación supera este número de turnos sin avanzar, deriva igual.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="msg-fallback" className="text-xs">
          Mensaje de derivación a vendedora
        </Label>
        <textarea
          id="msg-fallback"
          value={mensajeFallback}
          onChange={(e) => setMensajeFallback(e.target.value)}
          rows={2}
          placeholder="Te derivo con una de nuestras vendedoras para que te ayude mejor con eso 🙌"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          La IA usa esta frase cuando la pregunta no está en el FAQ y cuando deriva tras la primera respuesta. Si dejas vacío usa el default.
        </p>
      </div>

      <div>
        <Label htmlFor="msg-fuera" className="text-xs">
          Mensaje fuera de horario
        </Label>
        <textarea
          id="msg-fuera"
          value={mensajeFuera}
          onChange={(e) => setMensajeFuera(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] text-muted-foreground">
          Última actualización: {new Date(config.updated_at).toLocaleString('es-CL')}
        </p>
        <Button onClick={handleGuardar} disabled={!dirty || guardando} size="sm">
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
}
