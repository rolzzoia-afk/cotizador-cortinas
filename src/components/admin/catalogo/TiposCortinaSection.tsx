// ─────────────────────────────────────────────────────────────────────
// Admin → Catálogo técnico → Tipos de cortina propios
//
// Un tipo nuevo se crea SOBRE UN MOLDE: una de las cortinas que la app ya sabe
// fabricar. De ahí hereda todo el flujo (despiece, insumos, columnas del Excel
// de órdenes, etiqueta, bloque del Cálculo General); lo que puede tener propio
// son los NÚMEROS — un parche de fórmulas si el molde es de oscuridad, o filas
// propias del catálogo si es roller/dúo/pletina.
//
// El asistente pregunta lo necesario para que el tipo quede unido al flujo y
// cierra mostrando dónde quedó conectado.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BASES_PERMITIDAS,
  GRUPO_TIPOS_PROPIOS,
  baseEsOscuridad,
  validarTipos,
  type TipoCortina,
} from '@/modules/descuentos/tiposCortina';
import {
  guardarReglasSeleccion,
  respaldarReglasSeleccion,
  useReglasSeleccion,
} from '@/modules/descuentos/reglasSeleccionStore';
import {
  FORMULAS_OSCURIDAD_DEFAULT,
  VARIANTES_OSCURIDAD,
  esFamiliaSoftLight,
  familiaOscuridad,
  type FamiliaOscuridad,
  type ParcheOscuridad,
  type TernaVariantes,
} from '@/modules/descuentos/reglas-oscuridad';
import {
  guardarFormulas,
  respaldarFormulas,
  useFormulasFamilias,
} from '@/modules/descuentos/formulasStore';
import type {
  MatchCategoria,
  ReglaMecAncho,
  ReglaMecCategoria,
} from '@/modules/descuentos/reglas-mecanismo';
import type { ReglaTuboCategoria } from '@/modules/descuentos/reglas-tuberia';

/** Qué hereda cada molde, en palabras del taller. */
const RESUMEN_MOLDE: Record<string, string> = {
  ROL: 'Roller simple: tubo y peso con los descuentos de la fila del catálogo, tapas de peso por color, kit por color y tubo por ancho.',
  ROL_DUAL: 'Dos telas en un bracket: mecanismo dual por lado y color, sin regla por ancho.',
  ROL_MANUAL_CENEFA_OVALADA_38mm: 'Roller con cenefa ovalada de 38 mm: bracket BRA01/02, kit ovalada por color.',
  ROL_MANUAL_CENEFA_OVALADA_45mm: 'Roller con cenefa ovalada de 45 mm (tubo E78), kit ovalada por color.',
  ROL_CENEFA_OVALADA_MOTOR_PEQUEÑO: 'Roller motorizado con cenefa ovalada, motor chico.',
  ROL_CENEFA_OVALADA_MOTOR_GRANDE: 'Roller motorizado con cenefa ovalada, motor grande.',
  PLETINA_ROLLER_V: 'Pletina en V: sin tubo, se pega con velcro; descuentos directos del ancho y tela a la medida exacta.',
  DUO_MANUAL_38mm: 'Dúo día/noche de 38 mm: barra de peso dúo con tapas a presión, kit ovalada por color.',
  DUO_MANUAL_45mm: 'Dúo día/noche de 45 mm (tubo E78), kit ovalada por color.',
  DUO_MOTOR_PEQUEÑO_38mm: 'Dúo motorizado de 38 mm, motor chico.',
  DUO_MOTOR_GRANDE_45mm: 'Dúo motorizado de 45 mm, motor grande.',
  PLETINA_DUO_V: 'Pletina dúo en V: sin tubo, con barra de peso dúo.',
  SOFT_LIGHT_38mm: 'Soft Light 38 mm: cenefa ovalada, corte NETO (cada pieza se mide desde el ancho), perfiles laterales opcionales.',
  SOFT_LIGHT_45mm: 'Soft Light 45 mm: igual que el de 38, con el tubo de 45.',
  DARK_38mm: 'Dark 38 mm: cenefa cuadrada delantera y trasera, cadena encadenada (cenefa → tubo → tela → peso), tira de velcro y tapas a presión.',
  DARK_45mm: 'Dark 45 mm: mismo encadenado que el de 38, con kit y tubo de 45.',
  OSCURANTI_63mm: 'Oscuranti 63 mm: perfil superior como pieza frontal, cadena encadenada, tubo E47 fijo.',
};

/** Tablas que puede tener el parche según el molde. */
type CampoParche = { clave: keyof ParcheOscuridad; etiqueta: string; ayuda: string };

const CAMPOS_NETOS: CampoParche[] = [
  { clave: 'cenefaAdj', etiqueta: 'Cenefa', ayuda: 'Ajuste sobre el ancho de la ventana.' },
  { clave: 'tuboAdj', etiqueta: 'Tubo', ayuda: 'Ajuste sobre el ancho.' },
  { clave: 'telaAdj', etiqueta: 'Tela', ayuda: 'Ajuste sobre el ancho.' },
  { clave: 'pesoAdj', etiqueta: 'Peso', ayuda: 'Ajuste sobre el ancho.' },
];

const CAMPOS_ENCADENADOS: CampoParche[] = [
  { clave: 'cenefaAdj', etiqueta: 'Pieza frontal', ayuda: 'Ajuste sobre el ancho de la ventana.' },
  { clave: 'tuboPaso', etiqueta: 'Paso al tubo', ayuda: 'Cuánto se descuenta desde la pieza anterior.' },
  { clave: 'infDesc', etiqueta: 'Perfil inferior', ayuda: 'Descuento del perfil base.' },
];

/** Copia los números del molde para que el tipo nazca igual y se pueda calibrar. */
function parcheDesdeMolde(base: string): ParcheOscuridad {
  const familia = familiaOscuridad(base);
  if (!familia) return {};
  const f = FORMULAS_OSCURIDAD_DEFAULT;
  const copia = (t: readonly number[] | undefined): TernaVariantes | undefined =>
    t ? ([t[0], t[1], t[2]] as TernaVariantes) : undefined;
  const parche: ParcheOscuridad = { cenefaAdj: copia(f.cenefaAdj[familia]) };
  if (esFamiliaSoftLight(familia)) {
    parche.tuboAdj = copia(f.tuboAdj[familia]);
    parche.telaAdj = copia(f.telaAdj[familia]);
    parche.pesoAdj = copia(f.pesoAdj[familia]);
  } else {
    parche.tuboPaso = copia(f.tuboPaso[familia as Exclude<FamiliaOscuridad, 'SOFT_LIGHT_38' | 'SOFT_LIGHT_45' | 'SOFT_LIGHT_CC'>]);
  }
  parche.infDesc = copia(f.infDesc[familia]);
  return parche;
}

/** Sugiere una categoría técnica a partir del nombre visible. */
function categoriaSugerida(nombre: string, base: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!limpio) return '';
  const mm = base.match(/(\d{2})\s*mm/i);
  const conMm = /\d{2}MM$/i.test(limpio) || !mm ? limpio : `${limpio}_${mm[1]}mm`;
  return /^[A-Za-z]/.test(conMm) ? conMm : `T_${conMm}`;
}

const tipoVacio = (): TipoCortina => ({
  categoria: '',
  nombre: '',
  grupo: GRUPO_TIPOS_PROPIOS,
  base: '',
  activo: true,
});

export function TiposCortinaSection() {
  const { empresaId } = useAuth();
  const confirmar = useConfirm();
  const { reglas, loading, refresh } = useReglasSeleccion();
  const { formulas, refresh: refreshFormulas } = useFormulasFamilias();

  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState(1);
  const [editando, setEditando] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoCortina>(tipoVacio());
  const [parche, setParche] = useState<ParcheOscuridad>({});
  const [copiarReglas, setCopiarReglas] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [catTocada, setCatTocada] = useState(false);

  const tipos = reglas.tipos;
  const esOscuridad = baseEsOscuridad(tipo.base);
  const familia = useMemo(() => familiaOscuridad(tipo.base), [tipo.base]);
  const campos = familia && esFamiliaSoftLight(familia) ? CAMPOS_NETOS : CAMPOS_ENCADENADOS;

  // El validador corre sobre la lista COMPLETA: así detecta choques con los que ya existen.
  const validacion = useMemo(() => {
    const otros = tipos.filter((t) => t.categoria !== editando);
    return validarTipos([...otros, tipo]);
  }, [tipos, tipo, editando]);
  const puedeGuardar = tipo.categoria && tipo.base && validacion.errores.length === 0;

  useEffect(() => {
    if (!catTocada && tipo.nombre && tipo.base) {
      setTipo((t) => ({ ...t, categoria: categoriaSugerida(t.nombre, t.base) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo.nombre, tipo.base, catTocada]);

  const abrirNuevo = () => {
    setTipo(tipoVacio());
    setParche({});
    setEditando(null);
    setCatTocada(false);
    setCopiarReglas(true);
    setPaso(1);
    setAbierto(true);
  };

  const abrirEdicion = (t: TipoCortina) => {
    setTipo({ ...t });
    setParche(formulas.oscuridad.porTipo[t.categoria] ?? {});
    setEditando(t.categoria);
    setCatTocada(true);
    setCopiarReglas(false);
    setPaso(1);
    setAbierto(true);
  };

  const elegirMolde = (base: string) => {
    setTipo((t) => ({ ...t, base }));
    setParche(baseEsOscuridad(base) ? parcheDesdeMolde(base) : {});
  };

  const editarTerna = (clave: keyof ParcheOscuridad, i: number, valor: string) => {
    const n = parseFloat(valor.replace(',', '.'));
    setParche((p) => {
      const actual = (p[clave] as TernaVariantes | undefined) ?? [0, 0, 0];
      const terna = [...actual] as TernaVariantes;
      terna[i] = Number.isFinite(n) ? n : 0;
      return { ...p, [clave]: terna };
    });
  };

  /** Copia para el tipo nuevo las reglas de selección que hoy usa su molde. */
  const reglasCopiadas = () => {
    const base = tipo.base.toUpperCase();
    const cat = tipo.categoria;
    const mismaBase = (c: MatchCategoria) =>
      typeof c === 'string' && c.trim().toUpperCase() === base;
    const anchoNuevas: ReglaMecAncho[] = reglas.mecanismo.reglasAncho
      .filter((r) => mismaBase(r.categoria))
      .map((r) => ({ ...r, categoria: cat, descripcion: `${r.descripcion} — ${cat}` }));
    const catNuevas: ReglaMecCategoria[] = reglas.mecanismo.reglasCategoria
      .filter((r) => mismaBase(r.categoria))
      .map((r) => ({ ...r, categoria: cat, descripcion: `${r.descripcion} — ${cat}` }));
    const tubNuevas: ReglaTuboCategoria[] = reglas.tuberia.reglasCategoria
      .filter((r) => mismaBase(r.categoria))
      .map((r) => ({ ...r, categoria: cat, descripcion: `${r.descripcion} — ${cat}` }));
    return { anchoNuevas, catNuevas, tubNuevas };
  };

  const onGuardar = async () => {
    if (!empresaId || !puedeGuardar) return;
    if (validacion.avisos.length > 0) {
      const ok = await confirmar({
        titulo: 'Hay avisos',
        mensaje: `${validacion.avisos.join('\n')}\n\n¿Guardar igual?`,
        confirmLabel: 'Guardar igual',
      });
      if (!ok) return;
    }
    setGuardando(true);
    try {
      const otros = tipos.filter((t) => t.categoria !== editando);
      let mecanismo = reglas.mecanismo;
      let tuberia = reglas.tuberia;
      if (copiarReglas) {
        const { anchoNuevas, catNuevas, tubNuevas } = reglasCopiadas();
        if (anchoNuevas.length || catNuevas.length) {
          mecanismo = {
            ...mecanismo,
            reglasAncho: [...anchoNuevas, ...mecanismo.reglasAncho],
            reglasCategoria: [...catNuevas, ...mecanismo.reglasCategoria],
          };
        }
        if (tubNuevas.length) {
          tuberia = { ...tuberia, reglasCategoria: [...tubNuevas, ...tuberia.reglasCategoria] };
        }
      }
      await respaldarReglasSeleccion(empresaId, reglas, `antes de crear ${tipo.categoria}`);
      await guardarReglasSeleccion(empresaId, {
        mecanismo,
        tuberia,
        tipos: [...otros, tipo],
        colores: reglas.colores,
        cadenas: reglas.cadenas,
      });

      if (esOscuridad && Object.keys(parche).length > 0) {
        await respaldarFormulas(empresaId, formulas, `antes de crear ${tipo.categoria}`);
        const porTipo = { ...formulas.oscuridad.porTipo };
        if (editando && editando !== tipo.categoria) delete porTipo[editando];
        porTipo[tipo.categoria] = parche;
        await guardarFormulas(empresaId, {
          ...formulas,
          oscuridad: { ...formulas.oscuridad, porTipo },
        });
        await refreshFormulas();
      }
      await refresh();
      setAbierto(false);
      toast.success(
        editando
          ? `«${tipo.nombre}» actualizado.`
          : `«${tipo.nombre}» creado. Ya aparece en Fase 1 y se fabrica como ${tipo.base}.`,
      );
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (t: TipoCortina) => {
    if (!empresaId) return;
    const otros = tipos.filter((x) => x.categoria !== t.categoria);
    await guardarReglasSeleccion(empresaId, {
      ...reglas,
      tipos: [...otros, { ...t, activo: !t.activo }],
    });
    await refresh();
    toast.success(
      t.activo
        ? `«${t.nombre}» ya no se ofrece. Las órdenes guardadas se siguen calculando igual.`
        : `«${t.nombre}» vuelve a ofrecerse.`,
    );
  };

  const eliminar = async (t: TipoCortina) => {
    if (!empresaId) return;
    // Aviso best-effort: si hay órdenes con este tipo, borrarlo las dejaría
    // calculándose como un roller genérico.
    let enUso = 0;
    try {
      const { count } = await supabase
        .from('ots')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .contains('items', JSON.stringify([{ categoria: t.categoria }]));
      enUso = count ?? 0;
    } catch {
      enUso = -1;
    }
    const mensaje =
      enUso > 0
        ? `${enUso} ${enUso === 1 ? 'orden usa' : 'órdenes usan'} «${t.nombre}». Si lo eliminas, esas cortinas se calcularán como un roller genérico.\n\nLo recomendable es desactivarlo: deja de ofrecerse pero las órdenes siguen bien.`
        : `Se elimina «${t.nombre}» y sus números propios.\n\nSi alguna orden lo usa, pasará a calcularse como un roller genérico. Desactivarlo es más seguro.`;
    const ok = await confirmar({
      titulo: 'Eliminar el tipo de cortina',
      mensaje,
      confirmLabel: 'Eliminar igual',
    });
    if (!ok) return;
    await respaldarReglasSeleccion(empresaId, reglas, `antes de eliminar ${t.categoria}`);
    await guardarReglasSeleccion(empresaId, {
      ...reglas,
      tipos: tipos.filter((x) => x.categoria !== t.categoria),
    });
    if (formulas.oscuridad.porTipo[t.categoria]) {
      const porTipo = { ...formulas.oscuridad.porTipo };
      delete porTipo[t.categoria];
      await guardarFormulas(empresaId, {
        ...formulas,
        oscuridad: { ...formulas.oscuridad, porTipo },
      });
      await refreshFormulas();
    }
    await refresh();
    toast.success(`«${t.nombre}» eliminado.`);
  };

  const pasos = esOscuridad ? 5 : 5;
  const puedeAvanzar =
    (paso === 1 && !!tipo.nombre.trim() && !!tipo.categoria.trim()) ||
    (paso === 2 && !!tipo.base) ||
    paso >= 3;

  return (
    <>
      <section className="rounded-lg border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <Layers className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold text-muted-foreground">Tipos de cortina propios</h2>
          <Button size="sm" className="ml-auto" onClick={abrirNuevo} disabled={loading}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Crear tipo de cortina
          </Button>
        </header>

        <p className="mb-3 text-xs text-muted-foreground">
          Un tipo nuevo se crea sobre una cortina que la app ya sabe fabricar (su molde) y hereda
          todo su flujo: despiece, insumos, Excel de órdenes, etiquetas e inventario. Lo que puede
          tener propio son las medidas.
        </p>

        {tipos.length === 0 ? (
          <p className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
            Todavía no hay tipos propios. Las 19 cortinas de fábrica siguen disponibles como siempre.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Nombre</th>
                  <th className="py-1 pr-3">Categoría técnica</th>
                  <th className="py-1 pr-3">Se fabrica como</th>
                  <th className="py-1 pr-3">Estado</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {tipos.map((t) => (
                  <tr key={t.categoria} className="border-t">
                    <td className="py-1.5 pr-3 font-medium">{t.nombre}</td>
                    <td className="py-1.5 pr-3 font-mono text-[11px]">{t.categoria}</td>
                    <td className="py-1.5 pr-3">{t.base}</td>
                    <td className="py-1.5 pr-3">
                      <button
                        type="button"
                        onClick={() => alternarActivo(t)}
                        className={
                          t.activo
                            ? 'rounded border border-success/40 bg-success/10 px-2 py-0.5 text-success'
                            : 'rounded border px-2 py-0.5 text-muted-foreground'
                        }
                      >
                        {t.activo ? 'Se ofrece' : 'Oculto'}
                      </button>
                    </td>
                    <td className="py-1.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicion(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => eliminar(t)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editando ? 'Editar tipo de cortina' : 'Crear un tipo de cortina'}
            </DialogTitle>
            <DialogDescription>
              Paso {paso} de {pasos}
            </DialogDescription>
          </DialogHeader>

          {paso === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">¿Cómo se llama el tipo nuevo?</label>
                <Input
                  value={tipo.nombre}
                  onChange={(e) => setTipo({ ...tipo, nombre: e.target.value })}
                  placeholder="Roller industrial"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Es el nombre que verán las vendedoras en el selector de Fase 1.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Categoría técnica</label>
                <Input
                  value={tipo.categoria}
                  onChange={(e) => {
                    setCatTocada(true);
                    setTipo({ ...tipo, categoria: e.target.value });
                  }}
                  disabled={!!editando}
                  className="font-mono"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Es el COD SEC que viaja en el Excel de órdenes y en el importador de Fase 1.
                  Solo letras, números y guion bajo. Después de crearlo no conviene cambiarlo:
                  las órdenes ya guardadas lo tienen escrito.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium">Grupo en el selector</label>
                <Input
                  value={tipo.grupo}
                  onChange={(e) => setTipo({ ...tipo, grupo: e.target.value })}
                  placeholder={GRUPO_TIPOS_PROPIOS}
                />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                ¿A cuál de las cortinas actuales se parece en su <strong>fabricación</strong>? De
                ella hereda el despiece, los insumos y las etiquetas.
              </p>
              <div className="grid gap-1.5">
                {BASES_PERMITIDAS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => elegirMolde(b)}
                    className={
                      tipo.base === b
                        ? 'rounded border border-success bg-success/10 p-2 text-left'
                        : 'rounded border p-2 text-left hover:bg-muted/40'
                    }
                  >
                    <div className="flex items-center gap-2 text-xs font-medium">
                      {tipo.base === b && <Check className="h-3.5 w-3.5 text-success" />}
                      {b}
                    </div>
                    {RESUMEN_MOLDE[b] && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{RESUMEN_MOLDE[b]}</p>
                    )}
                  </button>
                ))}
              </div>
              <p className="rounded border border-dashed p-2 text-[11px] text-muted-foreground">
                Si no se fabrica como ninguna de estas —como pasó con el bee black, que tiene
                estructura propia— no alcanza con un tipo nuevo: eso necesita desarrollo.
              </p>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-3">
              {esOscuridad ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    Estos números nacen iguales a los de <strong>{tipo.base}</strong>. Cámbialos si
                    esta cortina se corta distinto; después puedes seguir ajustándolos en «Fórmulas
                    de corte».
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-3">Pieza</th>
                          {VARIANTES_OSCURIDAD.map((v) => (
                            <th key={v} className="py-1 pr-3">
                              {v}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campos.map((c) => {
                          const terna = (parche[c.clave] as TernaVariantes | undefined) ?? [0, 0, 0];
                          return (
                            <tr key={c.clave} className="border-t">
                              <td className="py-1.5 pr-3">
                                <div className="font-medium">{c.etiqueta}</div>
                                <div className="text-[11px] text-muted-foreground">{c.ayuda}</div>
                              </td>
                              {VARIANTES_OSCURIDAD.map((v, i) => (
                                <td key={v} className="py-1.5 pr-3">
                                  <Input
                                    value={String(terna[i]).replace('.', ',')}
                                    onChange={(e) => editarTerna(c.clave, i, e.target.value)}
                                    className="h-7 w-20 text-xs"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="rounded border border-dashed p-3 text-xs text-muted-foreground">
                  Este molde toma sus medidas de las <strong>filas del catálogo</strong> (la sección
                  «Modelos de despiece», arriba). El tipo nuevo usará las mismas filas que{' '}
                  <strong>{tipo.base}</strong>. Si necesitas medidas propias, duplica ahí la fila del
                  molde y ponle un tipo de rol propio; después se puede apuntar este tipo a esa fila.
                </p>
              )}
            </div>
          )}

          {paso === 4 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                ¿Qué tubo y qué mecanismo debe elegir la app para esta cortina?
              </p>
              <label className="flex items-start gap-2 rounded border p-3 text-xs">
                <input
                  type="checkbox"
                  checked={copiarReglas}
                  onChange={(e) => setCopiarReglas(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Usar las mismas reglas que {tipo.base || 'el molde'}.</strong>
                  <span className="mt-0.5 block text-muted-foreground">
                    Se copian sus reglas de tubo y de kit para la categoría nueva. Sin esto, la
                    cortina queda con la elección manual y hay que armar las reglas a mano en
                    «Selección de tubería y mecanismo».
                  </span>
                </span>
              </label>
            </div>
          )}

          {paso === 5 && (
            <div className="space-y-2 text-xs">
              <p className="font-medium">Dónde queda conectado «{tipo.nombre}»:</p>
              <ul className="space-y-1">
                {[
                  `Fase 1: aparece en el selector, dentro de «${tipo.grupo || GRUPO_TIPOS_PROPIOS}», y el importador acepta ${tipo.categoria} en la columna COD SEC.`,
                  `Fase 2: chips de mecanismo y tubería como ${tipo.base}.`,
                  esOscuridad
                    ? 'Despiece: corta con la mecánica del molde y los números que acabas de definir (editables en «Fórmulas de corte»).'
                    : `Despiece: usa las filas del catálogo de ${tipo.base}.`,
                  'Excel de órdenes y optimizador: las mismas columnas del molde, así que las piezas se cortan igual.',
                  'Cálculo General, etiquetas Brother, inventario y BOM: heredados del molde.',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded border border-warning/40 bg-warning/10 p-2">
                <strong>El precio no depende del tipo.</strong> Sale del producto (COD_INT) que se
                elige en Fase 1. Si esta cortina se vende con un producto nuevo, primero hay que
                darlo de alta en el catálogo de productos, desde Fase 1.
              </div>
              {validacion.errores.length > 0 && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2">
                  {validacion.errores.map((e) => (
                    <div key={e}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            {paso > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setPaso(paso - 1)}>
                Atrás
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              {paso < pasos ? (
                <Button size="sm" onClick={() => setPaso(paso + 1)} disabled={!puedeAvanzar}>
                  Continuar
                </Button>
              ) : (
                <Button size="sm" onClick={onGuardar} disabled={!puedeGuardar || guardando}>
                  {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear el tipo'}
                </Button>
              )}
            </div>
          </div>

          {paso <= 2 && validacion.errores.length > 0 && tipo.categoria && (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px]">
              {validacion.errores.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
