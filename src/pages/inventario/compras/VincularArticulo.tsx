// «¿Cuál es este artículo?» — la celda que empareja una línea de la orden con
// el catálogo.
//
// Casi todas las líneas llegan vinculadas solas, porque la orden trae nuestro
// código interno. Esta celda es para la que no: un código mal escrito en
// Finanzas, o un artículo que todavía no existe acá.
//
// Se resuelve UNA vez. Lo elegido queda aprendido contra el código del
// proveedor, y la próxima orden del mismo proveedor lo reconoce sola.

import { useMemo, useState } from 'react';
import { Check, Link2, Loader2, PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import { useInsumos } from '@/modules/inventario/insumosStore';
import { normalizarCodigoInsumo } from '@/modules/inventario/codigosInsumo';
import { textoConversion, type LineaOrden } from '@/modules/inventario/compras';
import { vincularLinea } from '@/modules/inventario/comprasStore';

const ETIQUETA_VINCULO: Record<string, string> = {
  interno: 'por el código de la orden',
  aprendida: 'aprendido de antes',
  codigo: 'por el código del proveedor',
  descripcion: 'por la descripción',
  manual: 'elegido a mano',
};

export function VincularArticulo({
  linea,
  puedeEditar,
  onVinculada,
}: {
  linea: LineaOrden;
  puedeEditar: boolean;
  onVinculada: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cod, setCod] = useState('');
  const [factor, setFactor] = useState(1);
  const [guardando, setGuardando] = useState(false);

  if (!abierto) {
    return (
      <div className="flex items-start gap-1.5">
        {linea.item_cod ? (
          <div className="min-w-0">
            <span className="font-mono font-medium">{linea.item_cod}</span>
            {linea.dominio === 'tela' && (
              <Badge variant="muted" className="ml-1.5">
                tela
              </Badge>
            )}
            {linea.vinculo && (
              <div className="text-[0.68rem] text-muted-foreground">
                {ETIQUETA_VINCULO[linea.vinculo] ?? linea.vinculo}
              </div>
            )}
          </div>
        ) : (
          <Badge variant="warning">¿Cuál?</Badge>
        )}
        {puedeEditar && (
          <button
            onClick={() => {
              setCod(linea.item_cod ?? '');
              setFactor(linea.factor || 1);
              setAbierto(true);
            }}
            aria-label={linea.item_cod ? 'Cambiar el artículo' : 'Elegir el artículo'}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {linea.item_cod ? (
              <PencilLine className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <Editor
      linea={linea}
      cod={cod}
      setCod={setCod}
      factor={factor}
      setFactor={setFactor}
      guardando={guardando}
      onCancelar={() => setAbierto(false)}
      onGuardar={async (dominio) => {
        const limpio = normalizarCodigoInsumo(cod);
        if (!limpio) {
          toast.warning('Falta el código del artículo.');
          return;
        }
        setGuardando(true);
        try {
          await vincularLinea(linea.id, dominio, limpio, factor, true);
          toast.success(`Línea vinculada a ${limpio}. Queda aprendido para la próxima orden.`);
          setAbierto(false);
          await onVinculada();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : String(e));
        } finally {
          setGuardando(false);
        }
      }}
    />
  );
}

function Editor({
  linea,
  cod,
  setCod,
  factor,
  setFactor,
  guardando,
  onCancelar,
  onGuardar,
}: {
  linea: LineaOrden;
  cod: string;
  setCod: (v: string) => void;
  factor: number;
  setFactor: (v: number) => void;
  guardando: boolean;
  onCancelar: () => void;
  onGuardar: (dominio: 'insumo' | 'tela') => Promise<void>;
}) {
  const { insumos } = useInsumos();
  const [dominio, setDominio] = useState<'insumo' | 'tela'>(linea.dominio ?? 'insumo');

  // Los candidatos salen del catálogo que la pantalla ya tiene cargado: se
  // buscan por código y por nombre, que es como los conoce el bodeguero.
  const sugerencias = useMemo(() => {
    const q = cod.trim().toUpperCase();
    if (q.length < 2 || dominio !== 'insumo') return [];
    return insumos
      .filter(
        (i) =>
          String(i.cod ?? '').toUpperCase().includes(q) ||
          String(i.nemotecnico ?? '').toUpperCase().includes(q),
      )
      .slice(0, 6);
  }, [insumos, cod, dominio]);

  const propuesto = useMemo(() => {
    const c = normalizarCodigoInsumo(cod);
    return insumos.find((i) => String(i.cod ?? '').toUpperCase() === c) ?? null;
  }, [insumos, cod]);

  return (
    <div className="min-w-[15rem] rounded-lg border border-accent/40 bg-secondary/30 p-2.5">
      <div className="flex items-center gap-1.5">
        {(['insumo', 'tela'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDominio(d)}
            className={
              dominio === d
                ? 'rounded-md border border-accent bg-accent/15 px-2 py-0.5 text-[0.7rem] font-medium'
                : 'rounded-md border border-border px-2 py-0.5 text-[0.7rem] text-muted-foreground'
            }
          >
            {d === 'insumo' ? 'Insumo' : 'Tela'}
          </button>
        ))}
      </div>

      <Label className="mt-2 block text-[0.68rem]">Código del catálogo</Label>
      <Input
        autoFocus
        value={cod}
        onChange={(e) => setCod(e.target.value)}
        placeholder={dominio === 'tela' ? 'BK74' : 'MEC18'}
        className="h-8 font-mono text-[0.78rem]"
      />
      {propuesto && (
        <div className="mt-1 truncate text-[0.68rem] text-success">
          {String(propuesto.nemotecnico ?? propuesto.cod)}
        </div>
      )}
      {sugerencias.length > 0 && !propuesto && (
        <div className="mt-1 flex flex-col gap-0.5">
          {sugerencias.map((s) => (
            <button
              key={String(s.cod)}
              onClick={() => setCod(String(s.cod))}
              className="truncate rounded px-1 py-0.5 text-left text-[0.68rem] text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <span className="font-mono">{String(s.cod)}</span> ·{' '}
              {String(s.nemotecnico ?? '')}
            </button>
          ))}
        </div>
      )}

      <Label className="mt-2 block text-[0.68rem]">
        Cuántas unidades nuestras trae una de la orden
      </Label>
      <InputDecimal
        value={factor}
        onChange={(v) => setFactor(v || 1)}
        className="h-8 text-[0.78rem]"
      />
      <div className="mt-1 text-[0.68rem] text-muted-foreground">
        {textoConversion(linea.cantidad_pedida, factor, linea.unidad)}
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          onClick={() => void onGuardar(dominio)}
          disabled={guardando}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[0.72rem] font-medium text-accent-foreground disabled:opacity-60"
        >
          {guardando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Vincular
        </button>
        <button
          onClick={onCancelar}
          className="rounded-md border border-border px-2 py-1 text-[0.72rem] text-muted-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default VincularArticulo;
