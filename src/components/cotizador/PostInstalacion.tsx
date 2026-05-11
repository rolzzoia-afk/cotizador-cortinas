import {
  POST_CHECKLIST_PREGUNTAS,
  POST_ENCUESTA_PREGUNTAS,
  type PostInstalacionData,
} from '@/modules/cotizador/fase2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  data: PostInstalacionData;
  onChange: (patch: Partial<PostInstalacionData>) => void;
};

export function PostInstalacion({ data, onChange }: Props) {
  const setCheck = (idx: number, val: boolean) => {
    const checks = [...data.checks];
    checks[idx] = val;
    onChange({ checks });
  };
  const setEncuesta = (idx: number, val: string) => {
    const encuesta = [...data.encuesta];
    encuesta[idx] = val;
    onChange({ encuesta });
  };

  const okCount = data.checks.filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Checklist */}
      <div className="rounded-md border border-border bg-card/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Checklist de calidad</h4>
          <span className="text-xs text-muted-foreground">
            {okCount} / {data.checks.length} verificados
          </span>
        </div>
        <div className="space-y-1.5">
          {POST_CHECKLIST_PREGUNTAS.map((pregunta, i) => (
            <label
              key={i}
              className="flex cursor-pointer items-start gap-2 rounded p-1.5 hover:bg-card"
            >
              <input
                type="checkbox"
                checked={!!data.checks[i]}
                onChange={(e) => setCheck(i, e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-card accent-indigo-500"
              />
              <span className="text-xs text-foreground">{pregunta}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Encuesta */}
      <div className="rounded-md border border-border bg-card/40 p-3">
        <h4 className="mb-3 text-sm font-semibold">Encuesta al cliente</h4>
        <div className="space-y-2">
          {POST_ENCUESTA_PREGUNTAS.map((pregunta, i) => (
            <div key={i}>
              <Label className="text-[0.78rem]">{pregunta}</Label>
              <Input
                value={data.encuesta[i] || ''}
                onChange={(e) => setEncuesta(i, e.target.value)}
                placeholder="Respuesta del cliente…"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <Label>Observaciones generales</Label>
        <textarea
          rows={3}
          value={data.observaciones || ''}
          onChange={(e) => onChange({ observaciones: e.target.value })}
          className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
          placeholder="Notas adicionales de la instalación…"
        />
      </div>
    </div>
  );
}
