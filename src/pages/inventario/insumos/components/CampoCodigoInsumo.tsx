// El código del artículo, en el formulario de alta.
//
// Se elige la FAMILIA y el código lo propone la base. Antes era un campo de
// texto libre con el ejemplo «INS-1234», un formato que no existe en la tabla:
// así se llegó a 37 prefijos, a un código con espacio y a numeración con
// huecos. El número definitivo lo asigna la base al guardar, así que acá dice
// «se confirma al guardar» en vez de prometer uno.
//
// Un administrador puede escribir otro código —lo que viene con código de
// fábrica o de una serie externa—, y ahí sí se valida la forma y se avisa si
// ya existe.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import {
  codigoVisible,
  normalizarCodigoInsumo,
  validarFormaCodigo,
  type FamiliaInsumo,
} from '@/modules/inventario/codigosInsumo';
import { previsualizarCodigo } from '@/modules/inventario/familiasStore';
import type { InsumoForm } from '../Insumos.types';

export default function CampoCodigoInsumo({
  editId,
  form,
  familias,
  puedeCodigoManual,
  onChange,
}: {
  editId: string | null;
  form: InsumoForm;
  familias: FamiliaInsumo[];
  puedeCodigoManual: boolean;
  onChange: (patch: Partial<InsumoForm>) => void;
}) {
  const { empresaId } = useAuth();
  const [proponiendo, setProponiendo] = useState(false);
  const [errorPropuesta, setErrorPropuesta] = useState<string | null>(null);
  const [yaExiste, setYaExiste] = useState(false);
  const pedido = useRef(0);

  const visible = codigoVisible(form.cod, form.color);
  const errorForma = form.codManual ? validarFormaCodigo(form.cod) : null;

  // Al elegir familia (o al volver del código a mano), se pide la propuesta.
  useEffect(() => {
    if (editId || form.codManual || !form.familia) return;
    const mio = ++pedido.current;
    setProponiendo(true);
    setErrorPropuesta(null);
    void previsualizarCodigo(form.familia).then((r) => {
      if (mio !== pedido.current) return;
      setProponiendo(false);
      if (r.ok) onChange({ cod: r.cod });
      else setErrorPropuesta(r.motivo);
    });
    // `onChange` cambia en cada render del padre: incluirlo repetiría la
    // consulta sin fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, form.codManual, form.familia]);

  // Con código a mano, avisar si ya está tomado antes de apretar Guardar.
  useEffect(() => {
    if (!form.codManual || !empresaId) {
      setYaExiste(false);
      return;
    }
    const c = normalizarCodigoInsumo(form.cod);
    if (!c || validarFormaCodigo(c)) {
      setYaExiste(false);
      return;
    }
    let vivo = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('insumos')
        .select('cod')
        .eq('empresa_id', empresaId)
        .eq('cod', c)
        .maybeSingle();
      if (vivo) setYaExiste(!!data);
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [form.codManual, form.cod, empresaId]);

  // Editar un artículo no toca su código: es la llave.
  if (editId) {
    return (
      <div className="flex-1">
        <Label>Código</Label>
        <Input value={visible} disabled />
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
          El código no se cambia. Si está mal, se da de alta uno nuevo y este queda descontinuado.
        </p>
      </div>
    );
  }

  const activas = familias.filter((f) => f.activo);

  return (
    <div className="flex-1">
      <Label>Código *</Label>
      <div className="flex gap-2">
        <select
          value={form.familia}
          onChange={(e) => {
            const fam = familias.find((f) => f.prefijo === e.target.value);
            onChange({
              familia: e.target.value,
              cod: '',
              // La familia trae su categoría: se propone sin pisar lo escrito.
              ...(fam && !form.categoria ? { categoria: fam.categoria || '' } : {}),
              ...(fam && !form.sub_categoria ? { sub_categoria: fam.sub_categoria || '' } : {}),
            });
          }}
          disabled={form.codManual}
          className="w-[46%] rounded-md border border-border bg-card px-2 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Familia…</option>
          {activas.map((f) => (
            <option key={f.prefijo} value={f.prefijo}>
              {f.nombre === f.prefijo ? f.prefijo : `${f.nombre} — ${f.prefijo}`}
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <Input
            value={form.cod}
            onChange={(e) => onChange({ cod: normalizarCodigoInsumo(e.target.value) })}
            readOnly={!form.codManual}
            placeholder={form.codManual ? 'Ej: MEC46' : 'Elige una familia'}
            className={form.codManual ? '' : 'bg-secondary/40'}
          />
          {proponiendo && (
            <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem]">
        {errorForma ? (
          <span className="text-destructive">{errorForma}</span>
        ) : yaExiste ? (
          <span className="text-destructive">Ese código ya existe.</span>
        ) : errorPropuesta ? (
          <span className="text-destructive">{errorPropuesta}</span>
        ) : form.cod && !form.codManual ? (
          <span className="text-muted-foreground">
            Siguiente de la familia {form.familia} · se confirma al guardar
          </span>
        ) : null}

        {activas.length === 0 && !form.codManual && (
          <span className="text-warning">
            Todavía no hay familias de código: falta correr la migración
            sql/20260910_insumos_01_familias.sql.
          </span>
        )}

        {form.cod && visible !== form.cod && (
          <span className="text-muted-foreground">
            Se verá como <b className="font-mono font-medium text-foreground">{visible}</b>
          </span>
        )}

        {puedeCodigoManual && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              checked={form.codManual}
              onChange={(e) => onChange({ codManual: e.target.checked, cod: '' })}
              className="h-3.5 w-3.5 accent-current"
            />
            Usar otro código
          </label>
        )}
      </div>
    </div>
  );
}
