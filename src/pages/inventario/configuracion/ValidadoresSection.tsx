// Las listas que ofrecen los desplegables del formulario de un insumo.
//
// El desorden del catálogo empezó acá: el formulario ofrecía 8 subcategorías
// mientras los artículos usaban 40, así que todo lo nuevo caía en MATERIALES.
// Por eso lo primero que muestra esta pantalla es el HUECO —lo que los
// artículos usan y el desplegable no ofrece— con un botón para cerrarlo.
//
// Un valor no se borra nunca: se apaga. Apagado deja de ofrecerse para lo
// nuevo y las fichas que ya lo tienen siguen enteras.

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { abreviaturaColor } from '@/modules/inventario/codigosInsumo';
import {
  CAMPOS_VALIDADOR,
  coloresSinAbreviatura,
  normalizarValorValidador,
  problemaValorNuevo,
  valoresHuerfanos,
} from '@/modules/inventario/validadores';
import {
  agregarValores,
  cambiarActivoValidador,
  useValidadores,
  useValoresEnUso,
} from '@/modules/inventario/validadoresStore';

export default function ValidadoresSection({ puedeEditar }: { puedeEditar: boolean }) {
  const { empresaId } = useAuth();
  const { filas, loading, error, recargar } = useValidadores();
  const { enUso } = useValoresEnUso();
  const [campo, setCampo] = useState('SUB_CATEGORIA');
  const [nuevo, setNuevo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const definicion = CAMPOS_VALIDADOR.find((c) => c.campo === campo) ?? CAMPOS_VALIDADOR[0];
  const delCampo = useMemo(() => filas.filter((f) => f.campo === campo), [filas, campo]);
  const huerfanos = useMemo(
    () => valoresHuerfanos(campo, enUso[campo] || [], filas),
    [campo, enUso, filas],
  );
  const sinAbreviatura = useMemo(
    () => (campo === 'COLOR' ? coloresSinAbreviatura(enUso.COLOR || []) : []),
    [campo, enUso],
  );
  const errorNuevo = nuevo.trim() ? problemaValorNuevo(nuevo, campo, filas) : null;

  // Cuántos artículos usan cada valor: sirve para saber qué se puede apagar
  // sin dejar fichas apuntando a algo que ya nadie ofrece.
  const usoPorValor = useMemo(() => {
    const n = new Map<string, number>();
    for (const v of enUso[campo] || []) {
      const k = normalizarValorValidador(v);
      n.set(k, (n.get(k) || 0) + 1);
    }
    return n;
  }, [enUso, campo]);

  const ordenSiguiente = () =>
    Math.max(100, ...filas.filter((f) => f.campo === campo).map((f) => (f.orden ?? 0) + 1));

  const agregar = async (valores: string[]) => {
    if (!empresaId || valores.length === 0) return;
    setOcupado(true);
    const r = await agregarValores(empresaId, campo, valores, ordenSiguiente());
    setOcupado(false);
    if (!r.ok) {
      toast.error(r.motivo);
      return;
    }
    toast.success(r.agregados === 1 ? 'Valor agregado' : `${r.agregados} valores agregados`);
    setNuevo('');
    await recargar();
  };

  const alternar = async (id: string, activo: boolean) => {
    setOcupado(true);
    const r = await cambiarActivoValidador(id, activo);
    setOcupado(false);
    if (!r.ok) {
      toast.error(r.motivo);
      return;
    }
    await recargar();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-3">
        <h2 className="font-serif text-[0.9375rem] font-medium">Listas del formulario</h2>
        {!puedeEditar && (
          <Badge variant="muted" className="ml-auto">
            Solo lectura
          </Badge>
        )}
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground">
        Lo que cada desplegable ofrece al crear o editar un artículo. Si un valor no está acá,
        nadie lo puede elegir y la ficha termina clasificada en el cajón genérico.
      </p>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {CAMPOS_VALIDADOR.map((c) => {
          const faltan = valoresHuerfanos(c.campo, enUso[c.campo] || [], filas).length;
          return (
            <button
              key={c.campo}
              onClick={() => setCampo(c.campo)}
              className={`rounded-full border px-2.5 py-1 text-[0.75rem] transition-colors ${
                c.campo === campo
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.titulo}
              {faltan > 0 && (
                <span className={c.campo === campo ? 'ml-1' : 'ml-1 text-warning'}>+{faltan}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="px-4 pb-3 text-xs text-muted-foreground">{definicion.hint}</p>

      {error && (
        <div className="mx-4 mb-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/[.09] p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      {huerfanos.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-warning/40 bg-warning/[.09] p-3 text-xs">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="min-w-0">
              <b>
                {huerfanos.length} {huerfanos.length === 1 ? 'valor que se usa' : 'valores que se usan'}{' '}
                y el formulario no ofrece
              </b>
              <p className="mt-1 font-mono text-[0.7rem]">{huerfanos.join(' · ')}</p>
            </div>
            {puedeEditar && (
              <Button
                size="sm"
                className="ml-auto shrink-0"
                onClick={() => void agregar(huerfanos)}
                disabled={ocupado}
              >
                {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Agregarlos
              </Button>
            )}
          </div>
        </div>
      )}

      {campo === 'COLOR' && sinAbreviatura.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <b>Colores sin abreviatura</b>
          <p className="mt-1">
            <span className="font-mono">{sinAbreviatura.join(' · ')}</span>
          </p>
          <p className="mt-1 text-muted-foreground">
            Estos artículos se ven sin color en el código: <span className="font-mono">TIR02</span>{' '}
            y no <span className="font-mono">TIR02-AZ</span>. No se inventa una abreviatura porque
            un sufijo que nadie definió se lee como otro código. Si alguno vale la pena, se agrega
            al diccionario en el módulo de códigos.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-4 pb-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Cargando listas…
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border border-t border-border">
          {delCampo.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Esta lista está vacía: el desplegable no ofrece nada.
            </div>
          )}
          {delCampo.map((f) => {
            const apagado = f.activo === false;
            const cuantos = usoPorValor.get(normalizarValorValidador(f.valor)) ?? 0;
            const abrev = campo === 'COLOR' ? abreviaturaColor(f.valor) : null;
            return (
              <div
                key={f.id ?? `${f.campo}:${f.valor}`}
                className={`flex items-center gap-2 px-4 py-2 text-[0.8125rem] ${apagado ? 'opacity-55' : ''}`}
              >
                <span className="font-medium">{f.valor}</span>
                {abrev && (
                  <Badge variant="outline" className="font-mono">
                    -{abrev}
                  </Badge>
                )}
                <span className="text-[0.7rem] text-muted-foreground">
                  {cuantos > 0
                    ? `${cuantos} ${cuantos === 1 ? 'artículo' : 'artículos'}`
                    : 'sin uso'}
                </span>
                {apagado && (
                  <Badge variant="muted" className="ml-1">
                    fuera del formulario
                  </Badge>
                )}
                {puedeEditar && f.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    disabled={ocupado}
                    onClick={() => void alternar(f.id!, apagado)}
                  >
                    {apagado ? 'Reactivar' : 'Quitar del alta'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {puedeEditar && (
        <div className="flex items-start gap-2 border-t border-border px-4 py-3">
          <div className="flex-1">
            <Input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              placeholder={`Agregar a ${definicion.titulo.toLowerCase()}…`}
              className="h-8"
            />
            {errorNuevo && <p className="mt-1 text-[0.7rem] text-destructive">{errorNuevo}</p>}
          </div>
          <Button
            size="sm"
            disabled={ocupado || !nuevo.trim() || !!errorNuevo}
            onClick={() => void agregar([nuevo])}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
