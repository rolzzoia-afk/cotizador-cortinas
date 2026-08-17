// ─────────────────────────────────────────────────────────────────────
// Admin → Precios → Tela de referencia por familia
//
// El Excel no cobra la tela al precio de la tela elegida: cobra el precio de UN
// código fijo por familia (el «arquetipo»). Por eso dos screen premium de telas
// distintas salen al mismo valor por metro. Acá se ve y se cambia cuál es.
// ─────────────────────────────────────────────────────────────────────
import { AlertTriangle, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { formatCLP } from '@/lib/formatters';
import type { CatalogoProductos } from '@/modules/cotizador/types';
import {
  BASE_VERTICAL_DEFAULT,
  BASE_VERTICAL_PROPIA,
  FAMILIAS_CON_RECETA,
  lamasPorPasada,
  type TelaVertical,
} from '@/modules/cotizador/reglasPrecios';

type Patch = {
  arquetipos?: Record<string, string>;
  baseVertical?: Record<string, string>;
  telaVertical?: TelaVertical;
};

type Props = {
  arquetipos: Record<string, string>;
  baseVertical: Record<string, string>;
  telaVertical: TelaVertical;
  catalogo: CatalogoProductos;
  onChange: (patch: Patch) => void;
};

const NOMBRE_FAMILIA: Record<string, string> = {
  BLACKOUT_P: 'Blackout premium', BLACKOUT_D: 'Blackout delux', BLACKOUT_S: 'Blackout standard',
  SCREEN_P: 'Screen premium', SCREEN_D: 'Screen delux', SCREEN_S: 'Screen standard',
  DUOBK_P: 'Dúo blackout premium', DUOBK_D: 'Dúo blackout delux', DUOBK_S: 'Dúo blackout standard',
  DUOPOLI_P: 'Dúo poliéster premium', DUOPOLI_D: 'Dúo poliéster delux', DUOPOLI_S: 'Dúo poliéster standard',
  BLACKOUT_V_P: 'Vertical blackout premium', BLACKOUT_V_D: 'Vertical blackout delux',
  BLACKOUT_V_S: 'Vertical blackout standard', SCREEN_V_P: 'Vertical screen premium',
  SCREEN_V_D: 'Vertical screen delux', SCREEN_V_S: 'Vertical screen standard',
};

function Tabla({
  titulo, mapa, catalogo, onChange,
}: {
  titulo: string;
  mapa: Record<string, string>;
  catalogo: CatalogoProductos;
  onChange: (m: Record<string, string>) => void;
}) {
  const claves = Object.keys(mapa).sort((a, b) => a.localeCompare(b, 'es'));
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold">{titulo}</h3>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Familia</th>
              <th className="px-2 py-1.5 text-left font-medium">Código de la tela</th>
              <th className="px-2 py-1.5 text-right font-medium">Precio por metro</th>
            </tr>
          </thead>
          <tbody>
            {claves.map((fam) => {
              const codInt = mapa[fam];
              const prod = catalogo[codInt];
              const precio = Number(prod?.precio) || 0;
              return (
                <tr key={fam} className="border-t">
                  <td className="px-2 py-1">
                    {NOMBRE_FAMILIA[fam] ?? fam}
                    <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">{fam}</span>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={codInt}
                      onChange={(e) => onChange({ ...mapa, [fam]: e.target.value.toUpperCase() })}
                      className="h-7 w-32 font-mono text-xs"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    {precio > 0 ? (
                      formatCLP(Math.round(precio))
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        no está en el catálogo
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * El interruptor del cobro por lamas. Va acá y no en una sección propia porque
 * decide CUÁNTA tela paga una vertical, justo al lado de con qué tela se paga.
 */
function TelaVerticalControl({
  valor,
  onChange,
}: {
  valor: TelaVertical;
  onChange: (patch: Patch) => void;
}) {
  const porLamas = valor.modo === 'lamas';
  const porPasada = lamasPorPasada(valor);
  const cubre = porPasada * valor.pasoLamaM;

  const cambiarModo = (lamas: boolean) => {
    onChange({
      telaVertical: { ...valor, modo: lamas ? 'lamas' : 'panos' },
      // El cobro por lamas viene con su propia tela: si se cobra el consumo
      // real, no tiene sentido seguir pagando la tela del roller.
      baseVertical: lamas ? BASE_VERTICAL_PROPIA : BASE_VERTICAL_DEFAULT,
    });
    toast.info(
      lamas
        ? 'Las verticales pasan a cobrarse por lamas y con su propia tela. Revisa el probador antes de guardar.'
        : 'Las verticales vuelven a cobrarse por paños enteros, con la tela del roller.',
    );
  };

  const num = (campo: keyof TelaVertical) => (v: string) =>
    onChange({ telaVertical: { ...valor, [campo]: Number(v) } });

  return (
    <div className="mb-4 rounded-md border p-3">
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={porLamas}
          onChange={(e) => cambiarModo(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Cobrar la tela de las verticales por lamas</strong>
          <span className="mt-1 block text-muted-foreground">
            Hoy se cobran por paños enteros, como en la planilla: una cortina apenas más ancha que
            el rollo paga el doble de tela, y por eso había que corregirlo a mano. Por lamas se
            cobra lo que se consume y el precio sube parejo con el ancho.
          </span>
        </span>
      </label>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Ancho de la lama (m)</span>
          <Input
            type="number"
            step="0.001"
            value={String(valor.anchoLamaM)}
            onChange={(e) => num('anchoLamaM')(e.target.value)}
            className="h-8 w-24 text-right text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Se monta cada (m)</span>
          <Input
            type="number"
            step="0.001"
            value={String(valor.pasoLamaM)}
            onChange={(e) => num('pasoLamaM')(e.target.value)}
            className="h-8 w-24 text-right text-xs"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-muted-foreground">Ancho del rollo vertical (m)</span>
          <Input
            type="number"
            step="0.01"
            value={String(valor.anchoRolloVerticalM)}
            onChange={(e) => num('anchoRolloVerticalM')(e.target.value)}
            className="h-8 w-28 text-right text-xs"
          />
        </label>
        <p className="max-w-sm text-[0.7rem] text-muted-foreground">
          De cada pasada del rollo salen <strong>{porPasada} lamas</strong>, que alcanzan para una
          cortina de hasta {cubre.toFixed(2)} m de ancho. El ancho se pide acá porque los códigos de
          tela vertical del catálogo tienen cargado el ancho de los rollos de roller.
        </p>
      </div>
    </div>
  );
}

export function TelasArquetiposSection({
  arquetipos,
  baseVertical,
  telaVertical,
  catalogo,
  onChange,
}: Props) {
  const faltantes = [...FAMILIAS_CON_RECETA].filter(
    (f) => !(Number(catalogo[arquetipos[f]]?.precio) > 0),
  );
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Scissors className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">Tela de referencia por familia</h2>
      </header>
      <p className="mb-3 text-xs text-muted-foreground">
        La tela se cobra al precio de <strong>este</strong> código, no al de la tela que eligió la
        clienta: por eso dos telas de la misma gama salen al mismo valor por metro.
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        <strong>Por qué las verticales apuntan a un roller:</strong> en la planilla, cada panel de
        verticales tiene escrito a mano el mismo precio de tela que el panel del roller de su misma
        gama. La tela vertical tiene su propio precio en el catálogo, pero el cálculo no lo usa. Acá
        se replica esa regla, y es editable: al activar el cobro por lamas, las verticales pasan a
        su propia tela, y cualquier código se puede cambiar a mano en la tabla.
      </p>

      <TelaVerticalControl valor={telaVertical} onChange={onChange} />
      {faltantes.length > 0 && (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          {faltantes.length === 1 ? 'Una familia tiene' : `${faltantes.length} familias tienen`} un
          código que no está en el catálogo de productos. Mientras siga así, esas cortinas se cobran
          con la tela más cara de su familia, que puede ser bastante más que lo que corresponde.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Tabla titulo="Roller y dúo" mapa={arquetipos} catalogo={catalogo} onChange={(m) => onChange({ arquetipos: m })} />
        <Tabla titulo="Verticales" mapa={baseVertical} catalogo={catalogo} onChange={(m) => onChange({ baseVertical: m })} />
      </div>
    </section>
  );
}
