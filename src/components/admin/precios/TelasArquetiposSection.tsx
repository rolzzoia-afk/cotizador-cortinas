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
  lamasPorPasada,
  type TelaVertical,
} from '@/modules/cotizador/reglasPrecios';
import { nombreFamilia } from './nombresFamilias';

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

/** La tela más cara de una familia: la regla del Excel cuando no hay código fijo. */
function maxDeFamilia(fam: string, catalogo: CatalogoProductos) {
  let codInt = '';
  let precio = 0;
  for (const [k, p] of Object.entries(catalogo)) {
    if (p?.cod !== fam) continue;
    const n = Number(p.precio) || 0;
    if (n > precio) { precio = n; codInt = k; }
  }
  return { codInt, precio };
}

/**
 * Lo que la app va a cobrar de verdad por metro en esta familia. Misma cascada
 * que `precioMlPorCod` del motor: el código declarado si está en el catálogo
 * con precio, y si no, la tela más cara de la familia. Se calcula acá y no se
 * llama al motor porque esta tabla trabaja sobre el BORRADOR, que todavía no
 * es un `ReglasPrecios` completo.
 */
function precioEfectivo(fam: string, codInt: string, catalogo: CatalogoProductos) {
  const declarado = codInt.trim();
  const pDeclarado = declarado ? Number(catalogo[declarado]?.precio) || 0 : 0;
  if (pDeclarado > 0) return { precio: pDeclarado, manda: declarado, roto: '' };
  const max = maxDeFamilia(fam, catalogo);
  return { precio: max.precio, manda: max.codInt, roto: declarado };
}

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
              const { precio, manda, roto } = precioEfectivo(fam, codInt, catalogo);
              return (
                <tr key={fam} className="border-t">
                  <td className="px-2 py-1">
                    {nombreFamilia(fam)}
                    <span className="ml-1.5 font-mono text-[0.65rem] text-muted-foreground">{fam}</span>
                  </td>
                  <td className="px-2 py-1">
                    <Input
                      value={codInt}
                      placeholder="la más cara"
                      onChange={(e) => onChange({ ...mapa, [fam]: e.target.value.toUpperCase() })}
                      className="h-7 w-32 font-mono text-xs"
                    />
                    {/* Siempre se dice qué código manda: con el campo vacío es
                        la regla del máximo, y con un código roto es el aviso de
                        que lo escrito no se está usando. */}
                    {roto ? (
                      <div className="mt-0.5 flex items-center gap-1 text-[0.65rem] text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {manda ? `${roto} no está en el catálogo: manda ${manda}` : `${roto} no está en el catálogo`}
                      </div>
                    ) : !codInt.trim() ? (
                      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {manda ? `hoy manda ${manda}` : 'ninguna tela de esta familia en el catálogo'}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {precio > 0 ? (
                      formatCLP(Math.round(precio))
                    ) : (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        sin precio
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

      {porLamas && (
        <label className="mt-2 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={valor.minimoUnaPasada}
            onChange={(e) => onChange({ telaVertical: { ...valor, minimoUnaPasada: e.target.checked } })}
            className="mt-0.5"
          />
          <span>
            <strong>Cobrar al menos una pasada completa por cortina</strong>
            <span className="mt-1 block text-muted-foreground">
              Con esto puesto, una cortina de hasta {cubre.toFixed(2)} m paga una pasada entera —lo
              mismo que paga hoy—, y recién de ahí para arriba se cobra la fracción. Sin esto, las
              verticales angostas bajan de precio: una de 2 m paga {((2 / valor.pasoLamaM) / porPasada * 100).toFixed(0)} % de
              una pasada en vez del 100 %.
            </span>
          </span>
        </label>
      )}

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
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        <strong>Cada cuánto se monta la lama</strong> manda las dos cuentas de la vertical: los
        metros de tela y la ferretería de la receta (carritos, pesos y espaciadores, que van «suma
        de anchos ÷ este número»). Cambiarlo mueve las dos a la vez.
      </p>
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
  // Un código escrito que el catálogo no tiene: la app lo ignora y cobra la
  // tela más cara de la familia. Se revisan las DOS tablas — antes solo se
  // miraban las 12 roller, y una vertical rota pasaba sin decir nada.
  const rotas = [
    ...Object.entries(arquetipos),
    ...Object.entries(baseVertical),
  ].filter(([, cod]) => cod.trim() && !(Number(catalogo[cod.trim()]?.precio) > 0));
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
      <p className="mb-3 text-xs text-muted-foreground">
        <strong>Dejar el código en blanco</strong> cobra <em>la tela más cara de la familia</em>,
        que es la fórmula original del Excel. Las familias beeblack vienen así; las roller y dúo no,
        porque en la planilla ese máximo se contaminaba con telas de otra familia y salía ~65 % más
        caro. Se puede escribir un código para fijarlo, o borrarlo para volver al máximo. Lo mismo
        vale si el código escrito no existe: la app cae al máximo igual, y la tabla lo avisa.
      </p>

      <TelaVerticalControl valor={telaVertical} onChange={onChange} />
      {rotas.length > 0 && (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          {rotas.length === 1 ? 'Una familia apunta a un código' : `${rotas.length} familias apuntan a códigos`}{' '}
          que no está{rotas.length === 1 ? '' : 'n'} en el catálogo de productos:{' '}
          <span className="font-mono">{rotas.map(([, c]) => c).join(', ')}</span>. Mientras siga así,
          esas cortinas se cobran con la tela más cara de su familia, que puede ser bastante más que
          lo que corresponde.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Tabla
          titulo="Roller, dúo y beeblack"
          mapa={arquetipos}
          catalogo={catalogo}
          onChange={(m) => onChange({ arquetipos: m })}
        />
        <Tabla titulo="Verticales" mapa={baseVertical} catalogo={catalogo} onChange={(m) => onChange({ baseVertical: m })} />
      </div>
    </section>
  );
}
