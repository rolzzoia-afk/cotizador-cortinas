// Admin → Datos de la empresa en el PDF de la cotización.
//
// Son los textos fijos de la plantilla que se manda al cliente: el encabezado,
// la banda de validez, los datos para transferir, los botones con enlace del pie
// y las bandas de cuotas. No salen en la pantalla de Fase 1: solo en el PDF
// descargable.

import { useEffect, useState, type ReactNode } from 'react';
import { Building2, RotateCcw, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import {
  DATOS_EMPRESA_DEFAULT,
  type BotonPdf,
  type DatosEmpresaCotizacion,
} from '@/modules/cotizador/datosEmpresaCotizacion';
import {
  guardarDatosEmpresa,
  useDatosEmpresaCotizacion,
} from '@/modules/cotizador/datosEmpresaCotizacionStore';
import { subirImagenDoc } from '@/modules/cotizador/docCotizacionStore';

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{titulo}</div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  ancho,
  ayuda,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Ocupa las dos columnas (textos largos). */
  ancho?: boolean;
  /** Bajada chica: para qué sirve el campo. */
  ayuda?: string;
}) {
  return (
    <label className={ancho ? 'block sm:col-span-2' : 'block'}>
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {ayuda && <span className="mt-1 block text-[11px] text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

function CampoLargo({
  label,
  value,
  onChange,
  filas = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  filas?: number;
}) {
  return (
    <label className="block sm:col-span-2">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={filas}
        className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export function DatosEmpresaSection() {
  const { empresaId } = useAuth();
  const { datosEmpresa, loading, refresh } = useDatosEmpresaCotizacion();
  const [draft, setDraft] = useState<DatosEmpresaCotizacion>(DATOS_EMPRESA_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(datosEmpresa);
      setDirty(false);
    }
  }, [loading, datosEmpresa]);

  /** Cambia un campo de una sección sin pisar el resto. */
  const setSeccion = <K extends keyof DatosEmpresaCotizacion>(
    clave: K,
    patch: Partial<DatosEmpresaCotizacion[K]>,
  ) => {
    setDraft((d) => ({ ...d, [clave]: { ...(d[clave] as object), ...patch } }));
    setDirty(true);
  };

  const setBoton = (i: number, patch: Partial<BotonPdf>) => {
    setDraft((d) => ({ ...d, botones: d.botones.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
    setDirty(true);
  };

  const subirLogo = async (file: File) => {
    if (!empresaId) return;
    setSubiendo(true);
    try {
      const url = await subirImagenDoc(empresaId, file);
      setSeccion('encabezado', { logoUrl: url });
      toast.success('Logo cargado. Presiona Guardar para aplicarlo.');
    } catch (e) {
      toast.error('No se pudo subir el logo: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubiendo(false);
    }
  };

  const onGuardar = async () => {
    if (!empresaId) return;
    setSaving(true);
    try {
      await guardarDatosEmpresa(empresaId, draft);
      await refresh();
      setDirty(false);
      toast.success('Datos guardados. El PDF de la cotización ya sale así.');
    } catch (e) {
      toast.error('Error al guardar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="mb-3 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-success" />
        <h2 className="text-sm font-semibold text-muted-foreground">
          Datos de la empresa en el PDF de la cotización
        </h2>
      </header>

      <p className="mb-4 text-xs text-muted-foreground">
        Lo que se imprime siempre igual en el PDF que se le manda al cliente: el encabezado, la
        cuenta para transferir, los botones con enlace y las bandas del pie. No cambian nada de lo
        que se ve en pantalla en Fase 1 ni de los precios.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="space-y-3">
            <Bloque titulo="Encabezado">
              <Campo
                label="Título"
                value={draft.encabezado.titulo}
                onChange={(v) => setSeccion('encabezado', { titulo: v })}
              />
              <Campo
                label="Bajada"
                value={draft.encabezado.subtitulo}
                onChange={(v) => setSeccion('encabezado', { subtitulo: v })}
              />
              <Campo
                label="Sitio web"
                value={draft.encabezado.web}
                onChange={(v) => setSeccion('encabezado', { web: v })}
              />
              <Campo
                label="Teléfono"
                value={draft.encabezado.telefono}
                onChange={(v) => setSeccion('encabezado', { telefono: v })}
              />
              <Campo
                label="RUT"
                value={draft.encabezado.rut}
                onChange={(v) => setSeccion('encabezado', { rut: v })}
              />
              <Campo
                label="Correos"
                value={draft.encabezado.correos}
                onChange={(v) => setSeccion('encabezado', { correos: v })}
              />
              <div className="sm:col-span-2">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  Logo
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {draft.encabezado.logoUrl ? (
                    <img
                      src={draft.encabezado.logoUrl}
                      alt="Logo"
                      className="h-10 w-auto rounded border bg-white p-1"
                    />
                  ) : (
                    <span className="text-[11px] italic text-muted-foreground">
                      Usando el logo Rolzzo de fábrica.
                    </span>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-secondary">
                    <Upload className="h-3.5 w-3.5" />
                    {subiendo ? 'Subiendo…' : 'Subir logo'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) subirLogo(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {draft.encabezado.logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSeccion('encabezado', { logoUrl: '' })}
                    >
                      Usar el de fábrica
                    </Button>
                  )}
                </div>
              </div>
            </Bloque>

            <Bloque titulo="Banda del título">
              <Campo
                label="Título (cotización normal)"
                value={draft.banda.titulo}
                onChange={(v) => setSeccion('banda', { titulo: v })}
                ayuda="Lo que dice la banda negra. Debajo sale la OT detallada en rojo."
              />
              <Campo
                label="Título de la categoría B"
                value={draft.banda.tituloCategoriaB}
                onChange={(v) => setSeccion('banda', { tituloCategoriaB: v })}
                ayuda="Se usa cuando TODAS las telas de la cotización son de categoría B."
              />
              <Campo
                label="Leyenda bajo las tarjetas"
                value={draft.banda.leyendaTarjetas}
                onChange={(v) => setSeccion('banda', { leyendaTarjetas: v })}
                ayuda="La categoría B muestra el sello de las 12 cuotas; el resto, solo las tarjetas con esta leyenda."
              />
            </Bloque>

            <Bloque titulo="Banda del pie">
              <Campo
                label="Con Mercadopago"
                value={draft.bandaFinal.titulo}
                onChange={(v) => setSeccion('bandaFinal', { titulo: v })}
                ancho
              />
              <CampoLargo
                label="Nota (Mercadopago)"
                value={draft.bandaFinal.nota}
                onChange={(v) => setSeccion('bandaFinal', { nota: v })}
                filas={2}
              />
              <Campo
                label="Con Flow"
                value={draft.bandaFinal.tituloFlow}
                onChange={(v) => setSeccion('bandaFinal', { tituloFlow: v })}
                ancho
                ayuda="Flow no ofrece cuotas sin interés: las pone el banco del cliente."
              />
              <CampoLargo
                label="Nota (Flow)"
                value={draft.bandaFinal.notaFlow}
                onChange={(v) => setSeccion('bandaFinal', { notaFlow: v })}
                filas={2}
              />
            </Bloque>

            <Bloque titulo="Recuadro de totales">
              <Campo
                label="Leyenda de las cuotas"
                value={draft.totales.leyendaCuotas}
                onChange={(v) => setSeccion('totales', { leyendaCuotas: v })}
                ancho
                ayuda="Sale en rojo pegada al total con tarjeta, como en la planilla. Con Flow no se imprime: ahí las cuotas y sus intereses los pone el banco del cliente. Vacío = no sale nunca."
              />
            </Bloque>

            <Bloque titulo="Tira de proyectos del pie">
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.fotosProyectos.visible}
                  onChange={(e) => setSeccion('fotosProyectos', { visible: e.target.checked })}
                  className="h-3.5 w-3.5"
                />
                <span>Mostrar la tira de fotos en el PDF</span>
              </label>
              <Campo
                label="Título de la banda"
                value={draft.fotosProyectos.titulo}
                onChange={(v) => setSeccion('fotosProyectos', { titulo: v })}
                ancho
              />
              <CampoLargo
                label="Texto de cierre"
                value={draft.fotosProyectos.subtitulo}
                onChange={(v) => setSeccion('fotosProyectos', { subtitulo: v })}
                filas={2}
              />
              <p className="text-[0.7rem] text-muted-foreground sm:col-span-2">
                Las fotos son la misma tira del Excel manual y vienen con la app: por ahora se
                cambian desde el código, no desde acá.
              </p>
            </Bloque>

            <Bloque titulo="Validez y contacto">
              <Campo
                label="Banda de validez"
                value={draft.validez.titulo}
                onChange={(v) => setSeccion('validez', { titulo: v })}
              />
              <Campo
                label="Detalle de la validez"
                value={draft.validez.detalle}
                onChange={(v) => setSeccion('validez', { detalle: v })}
              />
              <Campo
                label="Contacto (celda de la cabecera)"
                value={draft.contacto.texto}
                onChange={(v) => setSeccion('contacto', { texto: v })}
              />
              <Campo
                label="Enlace del contacto"
                value={draft.contacto.url}
                onChange={(v) => setSeccion('contacto', { url: v })}
                placeholder="https://…"
              />
            </Bloque>

            <Bloque titulo="Datos para transferencia">
              <Campo
                label="Título"
                value={draft.transferencia.titulo}
                onChange={(v) => setSeccion('transferencia', { titulo: v })}
              />
              <Campo
                label="Nombre / razón social"
                value={draft.transferencia.nombre}
                onChange={(v) => setSeccion('transferencia', { nombre: v })}
              />
              <Campo
                label="Tipo de cuenta"
                value={draft.transferencia.tipoCuenta}
                onChange={(v) => setSeccion('transferencia', { tipoCuenta: v })}
              />
              <Campo
                label="Banco"
                value={draft.transferencia.banco}
                onChange={(v) => setSeccion('transferencia', { banco: v })}
              />
              <Campo
                label="RUT"
                value={draft.transferencia.rut}
                onChange={(v) => setSeccion('transferencia', { rut: v })}
              />
              <Campo
                label="N° de cuenta"
                value={draft.transferencia.numero}
                onChange={(v) => setSeccion('transferencia', { numero: v })}
              />
              <Campo
                label="Mail"
                value={draft.transferencia.mail}
                onChange={(v) => setSeccion('transferencia', { mail: v })}
              />
              <CampoLargo
                label="Texto de arriba"
                value={draft.transferencia.intro}
                onChange={(v) => setSeccion('transferencia', { intro: v })}
                filas={2}
              />
            </Bloque>

            <div className="rounded-lg border p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Botones del pie
              </div>
              <div className="space-y-3">
                {draft.botones.map((b, i) => (
                  <div key={i} className="grid gap-3 sm:grid-cols-2">
                    <Campo
                      label={`Botón ${i + 1} — título`}
                      value={b.etiqueta}
                      onChange={(v) => setBoton(i, { etiqueta: v })}
                    />
                    <Campo
                      label="Texto del botón"
                      value={b.accion}
                      onChange={(v) => setBoton(i, { accion: v })}
                    />
                    <Campo
                      label="Enlace"
                      value={b.url}
                      onChange={(v) => setBoton(i, { url: v })}
                      placeholder="Vacío = botón sin enlace"
                    />
                    <Campo
                      label="Bajada"
                      value={b.nota}
                      onChange={(v) => setBoton(i, { nota: v })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Bloque titulo="Textos destacados">
              <CampoLargo
                label="Recuadro rojo de la categoría B (solo sale con telas B)"
                value={draft.bloqueCategoriaB.texto}
                onChange={(v) => setSeccion('bloqueCategoriaB', { texto: v })}
              />
              {/* La banda final tiene su propio bloque: cambia con el medio de pago. */}
              <Campo
                label='Enlace del botón "VER EJEMPLO" (onda en "V")'
                value={draft.urlEjemploOnda}
                onChange={(v) => {
                  setDraft((d) => ({ ...d, urlEjemploOnda: v }));
                  setDirty(true);
                }}
                placeholder="Vacío = no se dibuja el botón"
                ancho
              />
            </Bloque>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={onGuardar} disabled={saving || !empresaId || !dirty} size="sm">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Guardando…' : 'Guardar datos'}
            </Button>
            <Button
              onClick={() => {
                setDraft(DATOS_EMPRESA_DEFAULT);
                setDirty(true);
                toast.info('Cargados los datos por defecto. Presiona Guardar para aplicarlos.');
              }}
              variant="ghost"
              size="sm"
              disabled={saving}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar default
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
