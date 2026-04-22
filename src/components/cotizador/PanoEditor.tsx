import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OPCIONES_ARMADO,
  OPCIONES_ACCESORIO_COLOR,
  OPCIONES_CENEFA,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CIERRE_VERT,
  OPCIONES_COLOR_TAPA_CUADRADA,
  OPCIONES_COLOR_TAPA_OVALADA,
  OPCIONES_CORTES,
  OPCIONES_DUAL_COLOR,
  OPCIONES_DUAL_LADO,
  OPCIONES_INSTALACION,
  OPCIONES_LADO_MOTOR,
  OPCIONES_LARGO_CADENA,
  OPCIONES_MANILLA_COLOR,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MECANISMO,
  OPCIONES_MOTOR_TIPO,
  OPCIONES_ORDEN_DOBLE,
  OPCIONES_RELACION_MARCO,
  OPCIONES_SEPARADOR,
  OPCIONES_SOFT_DARK,
  OPCIONES_SUPERFICIE,
  OPCIONES_TIPO_TELA,
  OPCIONES_TUBERIA,
} from '@/modules/cotizador/fase2';
import type { Pano } from '@/modules/cotizador/types';

type Props = {
  pano: Pano;
  onChange: (patch: Partial<Pano>) => void;
  panoNum: number;
};

export function PanoEditor({ pano, onChange, panoNum }: Props) {
  return (
    <div className="space-y-3">
      {/* 0. MEDIDAS */}
      <Section title={`Medidas — Paño ${panoNum}`}>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Ancho (m)</Label>
            <Input
              type="number"
              step="0.01"
              value={pano.ancho as string | number}
              onChange={(e) => onChange({ ancho: e.target.value })}
              placeholder="1.50"
            />
          </div>
          <div>
            <Label>Alto (m)</Label>
            <Input
              type="number"
              step="0.01"
              value={pano.alto as string | number}
              onChange={(e) => onChange({ alto: e.target.value })}
              placeholder="2.40"
            />
          </div>
          <div>
            <Label>Color accesorios</Label>
            <Input
              value={pano.color || ''}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="Blanco"
            />
          </div>
        </div>
      </Section>

      {/* 1. ARMADO */}
      <Section title="Armado y tela">
        <RadioRow
          label="Armado"
          value={pano.armado || ''}
          options={OPCIONES_ARMADO}
          onChange={(v) => onChange({ armado: v })}
        />
        <RadioRow
          label="Tipo tela"
          value={pano.tipoTela || ''}
          options={OPCIONES_TIPO_TELA}
          onChange={(v) => onChange({ tipoTela: v })}
        />
      </Section>

      {/* 2. CADENA */}
      <Section title="Cadena">
        <RadioRow
          label="Largo"
          value={String(pano.largoCadena || '')}
          options={OPCIONES_LARGO_CADENA}
          onChange={(v) => onChange({ largoCadena: v })}
        />
        <RadioRow
          label="Cierre"
          value={pano.cierreVert || ''}
          options={OPCIONES_CIERRE_VERT}
          onChange={(v) => onChange({ cierreVert: v })}
        />
      </Section>

      {/* 3. MANILLA */}
      <Section title="Manilla">
        <div className="grid grid-cols-[120px_1fr] gap-3 items-start">
          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={0}
              value={pano.manillaCant ?? 0}
              onChange={(e) => onChange({ manillaCant: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <RadioRow
            label="Color"
            value={pano.manillaColor || ''}
            options={OPCIONES_MANILLA_COLOR}
            onChange={(v) => onChange({ manillaColor: v })}
          />
        </div>
      </Section>

      {/* 4. ACCESORIOS */}
      <Section title="Colores accesorios">
        <RadioRow
          label="Peso inf."
          value={pano.colorPeso || ''}
          options={OPCIONES_ACCESORIO_COLOR}
          onChange={(v) => onChange({ colorPeso: v })}
        />
        <RadioRow
          label="Cadena"
          value={pano.colorCadena || ''}
          options={OPCIONES_ACCESORIO_COLOR}
          onChange={(v) => onChange({ colorCadena: v })}
        />
        <RadioRow
          label="Mecanismo"
          value={pano.colorMecanismo || ''}
          options={OPCIONES_ACCESORIO_COLOR}
          onChange={(v) => onChange({ colorMecanismo: v })}
        />
      </Section>

      {/* 5. CENEFA */}
      <Section title="Cenefa">
        <RadioRow
          label="Tipo"
          value={pano.cenefa || 'No'}
          options={OPCIONES_CENEFA}
          onChange={(v) => onChange({ cenefa: v })}
        />
        {pano.cenefa === 'Ovalada' && (
          <RadioRow
            label="Color tapa"
            value={pano.colorTapa || ''}
            options={OPCIONES_COLOR_TAPA_OVALADA}
            onChange={(v) => onChange({ colorTapa: v })}
          />
        )}
        {pano.cenefa === 'Cuadrada' && (
          <>
            <RadioRow
              label="Tapas"
              value={pano.cenefaTapa || 'SIN_TAPA'}
              options={OPCIONES_CENEFA_TAPA}
              onChange={(v) => onChange({ cenefaTapa: v })}
            />
            <RadioRow
              label="Color tapa"
              value={pano.colorTapa || ''}
              options={OPCIONES_COLOR_TAPA_CUADRADA}
              onChange={(v) => onChange({ colorTapa: v })}
            />
          </>
        )}
      </Section>

      {/* 6. RETIRO */}
      <Section title="Retiro de cortinas">
        <div className="max-w-[120px]">
          <Label>Cantidad</Label>
          <Input
            type="number"
            min={0}
            value={pano.retiro ?? 0}
            onChange={(e) => onChange({ retiro: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      </Section>

      {/* 7. MATERIAL */}
      <Section title="Material de instalación">
        <RadioRow
          label="Posición"
          value={pano.superficie || ''}
          options={OPCIONES_SUPERFICIE}
          onChange={(v) => onChange({ superficie: v })}
        />
        <RadioRow
          label="Tipo"
          value={pano.materialTipo || ''}
          options={OPCIONES_MATERIAL_TIPO}
          onChange={(v) => onChange({ materialTipo: v })}
        />
      </Section>

      {/* 8. ORDEN DOBLE */}
      <Section title="Orden doble (solo cortina duo)">
        <Checkbox
          label="Es doble"
          checked={!!pano.ordenDoble}
          onChange={(v) => onChange({ ordenDoble: v })}
        />
        {pano.ordenDoble && (
          <RadioRow
            label="Orden"
            value={pano.ordenDobleOpcion || ''}
            options={OPCIONES_ORDEN_DOBLE as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ ordenDobleOpcion: v })}
          />
        )}
      </Section>

      {/* 9. MECANISMO */}
      <Section title="Mecanismo">
        <RadioRow
          label=""
          value={pano.mecanismo || ''}
          options={OPCIONES_MECANISMO}
          onChange={(v) => onChange({ mecanismo: v })}
        />
      </Section>

      {/* 10. DUAL */}
      <Section title="Mecanismo dual">
        <Checkbox
          label="Con mecanismo dual"
          checked={!!pano.dual}
          onChange={(v) => onChange({ dual: v })}
        />
        {pano.dual && (
          <>
            <RadioRow
              label="Lado"
              value={pano.dualLado || ''}
              options={OPCIONES_DUAL_LADO}
              onChange={(v) => onChange({ dualLado: v })}
            />
            <RadioRow
              label="Color"
              value={pano.dualColor || ''}
              options={OPCIONES_DUAL_COLOR}
              onChange={(v) => onChange({ dualColor: v })}
            />
          </>
        )}
      </Section>

      {/* 11. MOTOR */}
      <Section title="Motor">
        <RadioRow
          label="Tipo"
          value={pano.motorTipo || ''}
          options={OPCIONES_MOTOR_TIPO}
          onChange={(v) => onChange({ motorTipo: v })}
        />
        <div className="flex flex-wrap gap-4 pt-1">
          <Checkbox
            label="Control adicional"
            checked={!!pano.motorControlAdic}
            onChange={(v) => onChange({ motorControlAdic: v })}
          />
          <Checkbox
            label="Hub USB adicional"
            checked={!!pano.motorHubUsb}
            onChange={(v) => onChange({ motorHubUsb: v })}
          />
        </div>
        <RadioRow
          label="Lado motor"
          value={pano.ladoMotor || ''}
          options={OPCIONES_LADO_MOTOR}
          onChange={(v) => onChange({ ladoMotor: v })}
        />
      </Section>

      {/* 12. SOFT / DARK */}
      <Section title="Soft / Dark">
        <RadioRow
          label=""
          value={pano.softDark || 'N/A'}
          options={OPCIONES_SOFT_DARK}
          onChange={(v) => onChange({ softDark: v })}
        />
        {pano.softDark && pano.softDark !== 'N/A' && (
          <>
            <RadioRow
              label="Instalación"
              value={pano.instalacion || ''}
              options={OPCIONES_INSTALACION}
              onChange={(v) => onChange({ instalacion: v })}
            />
            <RadioRow
              label="Separador"
              value={pano.separador || ''}
              options={OPCIONES_SEPARADOR}
              onChange={(v) => onChange({ separador: v })}
            />
          </>
        )}
      </Section>

      {/* 13. TUBERÍA */}
      <Section title="Tubería">
        <RadioRow
          label=""
          value={pano.tuberia || ''}
          options={OPCIONES_TUBERIA}
          onChange={(v) => onChange({ tuberia: v })}
        />
      </Section>

      {/* 14. CORTES */}
      <Section title="Cortes en terreno">
        <RadioRow
          label=""
          value={pano.cortes || ''}
          options={OPCIONES_CORTES}
          onChange={(v) => onChange({ cortes: v })}
        />
        <Checkbox
          label="Ver video de terreno"
          checked={!!pano.verVideo}
          onChange={(v) => onChange({ verVideo: v })}
        />
      </Section>

      {/* 15. COMENTARIOS */}
      <Section title="Comentario adicional">
        <RadioRow
          label="Relación marco"
          value={pano.relacionMarco || ''}
          options={OPCIONES_RELACION_MARCO}
          onChange={(v) => onChange({ relacionMarco: v })}
        />
        <div>
          <Label>Cerrada a altura de</Label>
          <Input
            value={pano.alturaCierre || ''}
            onChange={(e) => onChange({ alturaCierre: e.target.value })}
            placeholder="Ej: 1.20m, ras de piso…"
          />
        </div>
        <div>
          <Label>Cotizar con y sin</Label>
          <Input
            value={pano.cotizarConSin || ''}
            onChange={(e) => onChange({ cotizarConSin: e.target.value })}
            placeholder="Ej: con cenefa, sin cenefa"
          />
        </div>
        <div>
          <Label>Suplementos</Label>
          <Input
            value={pano.suplementos || ''}
            onChange={(e) => onChange({ suplementos: e.target.value })}
          />
        </div>
        <div>
          <Label>Nota final</Label>
          <textarea
            rows={2}
            value={pano.comentarioFinal || ''}
            onChange={(e) => onChange({ comentarioFinal: e.target.value })}
            className="w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-sm"
          />
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-900/40 p-3">
      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

type StringOption = string | { value: string; label: string };

function RadioRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly StringOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="min-w-[80px] text-[0.72rem] text-zinc-400">{label}</span>}
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const val = typeof o === 'string' ? o : o.value;
          const lbl = typeof o === 'string' ? o : o.label;
          const active = value === val;
          return (
            <button
              type="button"
              key={val}
              onClick={() => onChange(active ? '' : val)}
              className={cn(
                'rounded border px-2 py-1 text-[0.7rem] transition-colors',
                active
                  ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                  : 'border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-white/20 bg-zinc-900 accent-indigo-500"
      />
      {label}
    </label>
  );
}
