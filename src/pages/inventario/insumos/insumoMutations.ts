// Guardar un insumo: el alta, la edición y la foto.
//
// Estaba dentro del orquestador de la pantalla, mezclado con el estado de los
// cuatro tabs. Acá queda solo lo que escribe, para que la pantalla se ocupe de
// mostrar y este archivo de guardar.
//
// El ALTA ya no arma el `insert`: se lo pide a `insumo_crear`, que es quien
// reparte el código. La EDICIÓN sigue siendo un `update` directo —el código no
// se toca al editar, así que no hay número que repartir—.

import { supabase } from '@/lib/supabase';
import { registrarMovimientos } from '@/modules/inventario/kardexStore';
import { crearInsumo, olvidarFamilias, type DatosInsumoNuevo } from '@/modules/inventario/familiasStore';
import { mesActual, type Insumo, type Movimiento } from '@/modules/inventario/helpers';
import type { InsumoForm } from './Insumos.types';

export type ResultadoAlta =
  | {
      ok: true;
      insumo: Insumo;
      /** Un movimiento legado que la pantalla debe agregar a su lista. */
      movimiento?: Movimiento;
      /** El artículo se creó, pero algo secundario no: se muestra aparte. */
      aviso?: string;
    }
  | { ok: false; motivo: string };

function texto(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Los campos del formulario tal como los espera la función de la base. */
function datosDelForm(f: InsumoForm): DatosInsumoNuevo {
  return {
    nemotecnico: f.nemotecnico.trim(),
    categoria: f.categoria,
    sub_categoria: f.sub_categoria,
    producto: f.producto,
    proveedor: f.proveedor,
    compra: f.compra,
    color: f.color,
    minimo: f.minimo,
    can_x_paquete: f.can_x_paquete,
    // Quien no ve la plata da de alta el artículo sin costo: se carga después
    // desde la ficha, que ya era de admin.
    costo: f.costo,
    ubicacion: f.ubicacion,
    cod_proveedor: f.cod_proveedor.trim(),
    estado_inventario: f.estado_inventario,
    descriptor_proveedor: f.descriptor_proveedor.trim(),
    comentarios: f.comentarios.trim(),
    foto_url: f.foto_url.trim(),
    unidad: f.unidad,
  };
}

/**
 * Da de alta el artículo y, si se escribió un stock inicial, lo ingresa.
 *
 * El ingreso va después y aparte a propósito: si fallara, el artículo ya está
 * creado y se avisa. Al revés —perder el artículo por un problema del
 * movimiento— obligaría a escribir el formulario entero de nuevo.
 */
export async function crearInsumoDesdeForm(opts: {
  empresaId: string;
  form: InsumoForm;
  kardexRpc: boolean;
}): Promise<ResultadoAlta> {
  const { empresaId, form, kardexRpc } = opts;

  const alta = await crearInsumo(
    form.familia,
    datosDelForm(form),
    form.codManual ? form.cod : null,
  );
  if (!alta.ok) return { ok: false, motivo: alta.motivo };

  olvidarFamilias(empresaId);
  const insumo = alta.insumo;
  const cod = insumo.cod || '';
  const stockInicial = parseInt(form.stock_inicial, 10) || 0;
  if (stockInicial <= 0) return { ok: true, insumo };

  // El artículo acaba de nacer en cero: esto es su primer ingreso.
  if (kardexRpc) {
    const r = await registrarMovimientos([
      {
        dominio: 'insumo',
        item_cod: cod,
        tipo: 'INGRESO',
        cantidad: stockInicial,
        destino: 'MP',
        motivo: 'Stock inicial al crear el insumo',
        referencia_tipo: 'manual',
      },
    ]);
    if (!r.ok) {
      return {
        ok: true,
        insumo,
        aviso: `El artículo se creó, pero su stock inicial no: ${r.motivo}`,
      };
    }
    return { ok: true, insumo: { ...insumo, stock_mp: stockInicial } };
  }

  try {
    const { data: movData, error: movErr } = await supabase
      .from('movimientos_insumos')
      .insert({
        empresa_id: empresaId,
        fecha: new Date().toISOString(),
        mes: mesActual(),
        tipo: 'NUEVO INGRESO',
        codigo: cod,
        producto: insumo.nemotecnico || insumo.descriptor_proveedor || '',
        almacen: 'MP',
        cantidad: stockInicial,
        ot: '',
        responsable_entrega: '',
        recepcion: '',
        bitacora: 'Stock inicial al crear insumo',
      })
      .select()
      .single();
    if (movErr) throw movErr;

    const { error: upErr } = await supabase
      .from('insumos')
      .update({ stock_mp: stockInicial })
      .eq('id', insumo.id);
    if (upErr) throw upErr;

    return {
      ok: true,
      insumo: { ...insumo, stock_mp: stockInicial },
      movimiento: (movData as Movimiento) || undefined,
    };
  } catch (e) {
    return {
      ok: true,
      insumo,
      aviso: `El artículo se creó, pero su stock inicial no: ${texto(e)}`,
    };
  }
}

/**
 * Guarda los cambios de un artículo que ya existe. El código no viaja: es la
 * llave, y en el formulario está bloqueado.
 */
export async function actualizarInsumoDesdeForm(
  editId: string,
  form: InsumoForm,
  /**
   * Si el formulario no mostró el costo, tampoco se manda. Sin esto, un
   * bodeguero que corrige un nemotécnico guardaría el `costo` del borrador
   * —que él no vio— y podría dejarlo en cero sin enterarse.
   */
  verMontos = true,
): Promise<{ ok: true; patch: Partial<Insumo> } | { ok: false; motivo: string }> {
  const costo = parseFloat(form.costo) || 0;
  const patch = {
    nemotecnico: form.nemotecnico.trim() || null,
    categoria: form.categoria || null,
    sub_categoria: form.sub_categoria || null,
    producto: form.producto || null,
    proveedor: form.proveedor || null,
    compra: form.compra || null,
    color: form.color || null,
    minimo: parseInt(form.minimo, 10) || 0,
    can_x_paquete: parseInt(form.can_x_paquete, 10) || 1,
    ...(verMontos ? { costo, costo_iva: Math.round(costo * 1.19 * 100) / 100 } : {}),
    ubicacion: form.ubicacion || null,
    cod_proveedor: form.cod_proveedor.trim() || null,
    estado_inventario: form.estado_inventario || 'ACTIVO',
    descriptor_proveedor: form.descriptor_proveedor.trim() || null,
    comentarios: form.comentarios.trim() || null,
    foto_url: form.foto_url.trim() || null,
    unidad: form.unidad || 'un',
  };

  const { error } = await supabase.from('insumos').update(patch).eq('id', editId);
  if (error) return { ok: false, motivo: error.message };
  return { ok: true, patch: patch as Partial<Insumo> };
}

/** Sube la foto al bucket y devuelve su URL pública. */
export async function subirFotoInsumo(
  empresaId: string,
  cod: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; motivo: string }> {
  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const nombre = (cod || 'insumo').trim().toUpperCase() || 'insumo';
    const path = `${empresaId}/${nombre}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('fotos-insumos')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from('fotos-insumos').getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('No se pudo obtener la URL pública');
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, motivo: texto(e) };
  }
}
