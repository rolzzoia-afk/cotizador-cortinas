import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  OPCIONES_ARMADO,
  OPCIONES_ACCESORIO_COLOR,
  OPCIONES_BRACKET_TIPO,
  OPCIONES_CENEFA,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CENEFA_TIRA,
  OPCIONES_CIERRE_VERT,
  OPCIONES_COLOR_TAPA_CUADRADA,
  OPCIONES_COLOR_TAPA_OVALADA,
  OPCIONES_CORTES,
  OPCIONES_INSTALACION,
  OPCIONES_LADO_MOTOR,
  OPCIONES_LARGO_CADENA,
  OPCIONES_MANILLA_COLOR,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_DUAL_LADO,
  OPCIONES_MECANISMO,
  OPCIONES_MOTOR_MODELO,
  OPCIONES_ORDEN_DOBLE,
  OPCIONES_RELACION_MARCO,
  OPCIONES_SEPARADOR,
  OPCIONES_SOFT_DARK,
  OPCIONES_SUPLEMENTO,
  OPCIONES_SUPERFICIE,
  OPCIONES_TIPO_MECANISMO,
  OPCIONES_TIPO_TELA,
  OPCIONES_TUBERIA,
  esCenefaCuadrada,
} from '@/modules/cotizador/fase2';
import type { Pano } from '@/modules/cotizador/types';
import { debeInvertirPano } from '@/modules/cotizador/tela';
import { cantidadSuplementosAuto } from '@/modules/cotizador/insumosCortina';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { colorAccesorioCorto } from '@/modules/cotizador/fase0-sync';
import {
  cadenasRoller,
  etiquetaCadena,
  derivarLargoColor,
  pesosSeleccionables,
  type CadenaInsumo,
} from '@/modules/cotizador/cadenas';
import {
  cortesOscuridad,
  familiaOscuridad,
  medidaPerfilOscuridad,
  normalizarVarianteOscuridad,
  PERFILES_OSCURIDAD,
  type PerfilesOscuridad,
  type VarianteOscuridad,
} from '@/modules/descuentos/reglas-oscuridad';
import { colorPerfilDesdeAdicional, type TipoPerfilAdicional } from '@/modules/descuentos/adicionales-perfil';
import { colorPesoInfOscuridadExcel } from '@/modules/descuentos/peso-oscuridad';
import {
  cortesBeeblack,
  esCategoriaBeeblack,
  medidaComponenteBeeblack,
  normalizarVarianteBeeblack,
  TOGGLES_BEEBLACK_EXTERNO,
  TOGGLES_BEEBLACK_INTERNO,
  type TogglesBeeblack,
  type VarianteBeeblack,
} from '@/modules/descuentos/reglas-beeblack';
import type { AdicionalFase0Persistido } from '@/modules/ots/types';

type Props = {
  pano: Pano;
  onChange: (patch: Partial<Pano>) => void;
  panoNum: number;
  /** Cadenas reales del inventario (CAD01…) para el selector. */
  cadenas?: CadenaInsumo[];
  /** Pesos de cadena del inventario (PCA01/PCA04) para el selector. */
  pesos?: CadenaInsumo[];
  /** Opciones filtradas de mecanismo (default: todas). */
  opcionesMecanismo?: readonly string[];
  /** Opciones filtradas de tubería (default: todas). */
  opcionesTuberia?: readonly string[];
  /** Nota cuando el mecanismo quedó fijo (p.ej. roller >3 m → 63 mm). */
  mecanismoFijoNota?: string;
  /** Ocultar sección mecanismo (VERTICAL, BEEBLACK). */
  ocultarMecanismo?: boolean;
  /** Categoría de la ventana (para detectar sistemas de oscuridad). */
  categoria?: string;
  /** Color de la ventana (fallback del color de accesorios). */
  colorVentana?: string | null;
  /** Sentido de instalación heredado de Fase 0 (default de la variante). */
  sentidoVentana?: string | null;
  /** Adicionales Fase 0 (colores de perfiles). */
  adicionalesFase0?: AdicionalFase0Persistido[];
  /** Ancho del rollo (m) para auto-sugerir corte invertido. Default 2,98. */
  anchoRollo?: number;
};

// Mapea cada interruptor de perfil a su campo ON/OFF en el Pano.
const PERFIL_FIELD: Record<keyof PerfilesOscuridad, keyof Pano> = {
  izqMuro: 'perfilIzqMuro',
  izqPiso: 'perfilIzqPiso',
  derMuro: 'perfilDerMuro',
  derPiso: 'perfilDerPiso',
  infMuro: 'perfilInfMuro',
  infPiso: 'perfilInfPiso',
};

// Mapea cada perfil a su campo de medida manual (override de terreno) en el Pano.
const PERFIL_MEDIDA_FIELD: Record<keyof PerfilesOscuridad, keyof Pano> = {
  izqMuro: 'perfilIzqMuroCm',
  izqPiso: 'perfilIzqPisoCm',
  derMuro: 'perfilDerMuroCm',
  derPiso: 'perfilDerPisoCm',
  infMuro: 'perfilInfMuroCm',
  infPiso: 'perfilInfPisoCm',
};

const PERFIL_TIPO_ADICIONAL: Record<keyof PerfilesOscuridad, TipoPerfilAdicional> = {
  izqMuro: 'izq',
  izqPiso: 'izq',
  derMuro: 'der',
  derPiso: 'der',
  infMuro: 'inf',
  infPiso: 'inf',
};

const OPCIONES_VARIANTE_OSCURIDAD = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'EXTERNO', label: 'Externo' },
] as const;

const OPCIONES_VARIANTE_BEEBLACK = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'EXTERNO_SEMI', label: 'Externo o Semi' },
] as const;

const BEEBLACK_TOGGLE_FIELD: Record<keyof TogglesBeeblack, keyof Pano> = {
  manillaIzq: 'beeblackManillaIzq',
  manillaDer: 'beeblackManillaDer',
  extraAnchoIzq: 'beeblackExtraSupInfIzq',
  extraAnchoDer: 'beeblackExtraSupInfDer',
  extraAltoSup: 'beeblackExtraLatSup',
  extraAltoInf: 'beeblackExtraLatInf',
};

const BEEBLACK_MANILLA_MEDIDA_FIELD: Record<'manillaIzq' | 'manillaDer', keyof Pano> = {
  manillaIzq: 'beeblackManillaIzqCm',
  manillaDer: 'beeblackManillaDerCm',
};

const BEEBLACK_FIJO_ROWS: Array<{
  key: keyof import('@/modules/descuentos/reglas-beeblack').MedidasBeeblack;
  label: string;
  field: keyof Pano;
  calcKey: Parameters<typeof medidaComponenteBeeblack>[1];
}> = [
  { key: 'perfilSupAncho', label: 'Perfil superior (ancho)', field: 'beeblackPerfilSupAnchoCm', calcKey: 'perfilSupAncho' },
  { key: 'perfilInfAncho', label: 'Perfil inferior (ancho)', field: 'beeblackPerfilInfAnchoCm', calcKey: 'perfilInfAncho' },
  { key: 'perfilLatIzq', label: 'Perfil lateral izq (alto)', field: 'beeblackPerfilLatIzqCm', calcKey: 'perfilLatIzq' },
  { key: 'perfilLatDer', label: 'Perfil lateral der (alto)', field: 'beeblackPerfilLatDerCm', calcKey: 'perfilLatDer' },
  { key: 'anchoTela', label: 'Ancho tela', field: 'beeblackAnchoTelaCm', calcKey: 'anchoTela' },
  { key: 'altoTela', label: 'Alto tela', field: 'beeblackAltoTelaCm', calcKey: 'altoTela' },
  { key: 'totalLamas', label: 'Total lamas corte', field: 'beeblackTotalLamasCm', calcKey: 'totalLamas' },
];

export function PanoEditor({
  pano,
  onChange,
  panoNum,
  cadenas = [],
  pesos = [],
  opcionesMecanismo = OPCIONES_MECANISMO,
  opcionesTuberia = OPCIONES_TUBERIA,
  mecanismoFijoNota,
  ocultarMecanismo = false,
  categoria,
  colorVentana,
  sentidoVentana,
  adicionalesFase0,
  anchoRollo = 2.98,
}: Props) {
  const cadenasDisponibles = cadenasRoller(cadenas);
  const pesosDisponibles = pesosSeleccionables(pesos);

  // Corte invertido (rotado): se auto-sugiere cuando la cortina + borde (4 cm)
  // no entra en el ancho del rollo. El flag explícito del usuario manda.
  const anchoPanoM = parseFloat(String(pano.ancho)) || 0;
  const debeInvertir = debeInvertirPano(anchoPanoM, anchoRollo);
  const invertida = pano.invertida ?? debeInvertir;
  // Cantidad auto de suplementos (roller 2 / cenefa 1 por bracket); editable.
  const suplementoAuto = cantidadSuplementosAuto(pano, categoria, anchoPanoM);

  // ── Sistema de oscuridad (Soft Light / Oscuranti / Dark) ──
  const familia = familiaOscuridad(categoria, pano.cenefa);
  const varianteOscuridad: VarianteOscuridad = normalizarVarianteOscuridad(
    pano.oscuridadVariante ?? sentidoVentana,
    'INTERNO',
  );
  const anchoCmOsc = (parseFloat(String(pano.ancho ?? 0)) || 0) * 100;
  const altoCmOsc = (parseFloat(String(pano.alto ?? 0)) || 0) * 100;
  const perfilesOsc: PerfilesOscuridad = {
    izqMuro: !!pano.perfilIzqMuro,
    izqPiso: !!pano.perfilIzqPiso,
    derMuro: !!pano.perfilDerMuro,
    derPiso: !!pano.perfilDerPiso,
    infMuro: !!pano.perfilInfMuro,
    infPiso: !!pano.perfilInfPiso,
  };
  const cortesOsc = familia
    ? cortesOscuridad(familia, varianteOscuridad, anchoCmOsc, altoCmOsc, perfilesOsc)
    : [];
  const componentesOsc = cortesOsc.filter((c) => !c.perfil);
  const colorPesoInfOscuridad = familia
    ? colorPesoInfOscuridadExcel(pano.colorPeso || pano.color)
    : '';

  // ── BEEBLACK ──
  const esBeeblack = esCategoriaBeeblack(categoria);
  // Dúo (día/noche): pide el cierre de altura medido en terreno.
  const esDuo = (categoria || '').toUpperCase().includes('DUO');

  // ── Gates por categoría (con escape: si hay dato guardado, se muestra) ──
  const catUpper = (categoria || '').toUpperCase();
  const esMotorCat = catUpper.includes('MOTOR');
  const esVerticalCat = catUpper.includes('VERTICAL');
  const categoriaImplicaOvalada = catUpper.includes('CENEFA_OVALADA');
  // Color de accesorios único (Medidas): el mismo resolutor que producción.
  const colorAccesorios = colorAccesorioCorto(colorAccesoriosDePano(pano, colorVentana));
  // Cierre Vertical/Medio solo aplica a VERTICAL; el resto ve Izq/Der
  // (más el valor guardado de OTs viejas, para no esconderlo).
  const opcionesCierre = esVerticalCat
    ? OPCIONES_CIERRE_VERT
    : OPCIONES_CIERRE_VERT.filter(
        (o) => o === 'Izquierda' || o === 'Derecha' || o === pano.cierreVert,
      );
  // Cenefa fija Ovalada cuando la categoría la implica (salvo dato legacy distinto).
  const cenefaFijaOvalada =
    categoriaImplicaOvalada && !esCenefaCuadrada(pano.cenefa);
  // F15: el motor DOM41 no se usa con cenefa ovalada (se cae a DOM38).
  const cenefaEsOvalada = pano.cenefa === 'Ovalada' || cenefaFijaOvalada;
  const opcionesMotorModelo = cenefaEsOvalada
    ? OPCIONES_MOTOR_MODELO.filter((o) => o.value !== 'DOM41')
    : OPCIONES_MOTOR_MODELO;
  // OTs viejas guardan 'Cuadrada' a secas: se muestra como chip extra para
  // no esconder el dato (al elegir muro/techo queda con el valor nuevo).
  const opcionesCenefa =
    pano.cenefa && esCenefaCuadrada(pano.cenefa) && !OPCIONES_CENEFA.includes(pano.cenefa as never)
      ? [...OPCIONES_CENEFA, pano.cenefa]
      : OPCIONES_CENEFA;
  // Soft/Dark legacy fuera de familia de oscuridad: solo si hay dato guardado.
  const softDarkLegacy =
    !familia &&
    !!((pano.softDark && pano.softDark !== 'N/A') || pano.instalacion || pano.separador);
  const varianteBeeblack: VarianteBeeblack = normalizarVarianteBeeblack(
    pano.beeblackVariante ?? sentidoVentana,
    'INTERNO',
  );
  const anchoCmBb = (parseFloat(String(pano.ancho ?? 0)) || 0) * 100;
  const altoCmBb = (parseFloat(String(pano.alto ?? 0)) || 0) * 100;
  const togglesBeeblack: TogglesBeeblack = {
    manillaIzq: pano.beeblackManillaIzq,
    manillaDer: pano.beeblackManillaDer,
    extraAnchoIzq: pano.beeblackExtraSupInfIzq,
    extraAnchoDer: pano.beeblackExtraSupInfDer,
    extraAltoSup: pano.beeblackExtraLatSup,
    extraAltoInf: pano.beeblackExtraLatInf,
  };
  const overridesBeeblack = {
    perfilSupAncho: pano.beeblackPerfilSupAnchoCm,
    perfilInfAncho: pano.beeblackPerfilInfAnchoCm,
    perfilLatIzq: pano.beeblackPerfilLatIzqCm,
    perfilLatDer: pano.beeblackPerfilLatDerCm,
    manillaIzq: pano.beeblackManillaIzqCm,
    manillaDer: pano.beeblackManillaDerCm,
    anchoTela: pano.beeblackAnchoTelaCm,
    altoTela: pano.beeblackAltoTelaCm,
    totalLamas: pano.beeblackTotalLamasCm,
  };
  const componentesBb =
    esBeeblack && anchoCmBb > 0 && altoCmBb > 0
      ? cortesBeeblack(varianteBeeblack, anchoCmBb, altoCmBb, togglesBeeblack, overridesBeeblack)
      : [];
  const togglesBeeblackUi =
    varianteBeeblack === 'INTERNO' ? TOGGLES_BEEBLACK_INTERNO : TOGGLES_BEEBLACK_EXTERNO;
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
            {/* Control ÚNICO de color: escribe de una vez los 4 campos que
                leen los consumidores (mecanismo/cadena/peso/tela). */}
            <div className="pt-1.5">
              <RadioRow
                label=""
                value={colorAccesorios}
                options={OPCIONES_ACCESORIO_COLOR}
                onChange={(v) =>
                  onChange({ color: v, colorMecanismo: v, colorCadena: v, colorPeso: v })
                }
              />
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            label="Corte invertido (rotado)"
            checked={invertida}
            onChange={(v) => onChange({ invertida: v })}
          />
          {debeInvertir && pano.invertida === undefined && (
            <span className="text-[0.7rem] text-amber-500">
              auto: no entra normal en el rollo ({anchoRollo.toFixed(2)} m)
            </span>
          )}
          {pano.invertida === false && debeInvertir && (
            <span className="text-[0.7rem] text-destructive">
              ¡no entra normal! confirma que esta tela no se puede rotar
            </span>
          )}
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
        {esDuo && (
          /* Dúo: cierre de altura medido en terreno por el vendedor — va en
             la etiqueta de estructura y en la hoja de cálculo general. */
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">
              Cierre de altura (cm)
            </span>
            <Input
              type="number"
              min={0}
              step={0.1}
              className="h-7 w-28 text-[0.72rem]"
              value={String(pano.cierreAlturaCm ?? '')}
              onChange={(e) =>
                onChange({ cierreAlturaCm: e.target.value === '' ? undefined : e.target.value })
              }
              placeholder="cm"
            />
            {!(parseFloat(String(pano.cierreAlturaCm ?? '')) > 0) &&
              (pano.alturaCierre ? (
                <span className="text-[0.7rem] text-muted-foreground">
                  terreno (texto viejo): {pano.alturaCierre}
                </span>
              ) : (
                <span className="text-[0.7rem] text-amber-500">
                  falta el cierre (lo mide el vendedor en terreno)
                </span>
              ))}
          </div>
        )}
      </Section>

      {/* 2. CADENA — la vertical no lleva cadena roller (usa su propio peso de
          cadena VER, que se lista en la hoja de inventario); conserva solo el
          Cierre (que sí aplica: es el lado de accionamiento de las lamas). */}
      <Section title="Cadena">
        {!esVerticalCat &&
          (cadenasDisponibles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Cadena</span>
              <select
                className="flex-1 min-w-[200px] rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
                value={pano.codCadena || ''}
                onChange={(e) => {
                  const cod = e.target.value;
                  if (!cod) {
                    onChange({ codCadena: '', largoCadena: '', colorCadena: '' });
                    return;
                  }
                  const { largoCadena, colorCadena } = derivarLargoColor(cod, cadenas);
                  onChange({ codCadena: cod, largoCadena, colorCadena });
                }}
              >
                <option value="">— Sin cadena —</option>
                {cadenasDisponibles.map((c) => (
                  <option key={c.cod} value={c.cod as string}>
                    {etiquetaCadena(c)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <RadioRow
              label="Largo"
              value={String(pano.largoCadena || '')}
              options={OPCIONES_LARGO_CADENA}
              onChange={(v) => onChange({ largoCadena: v })}
            />
          ))}
        <RadioRow
          label="Cierre"
          value={pano.cierreVert || ''}
          options={opcionesCierre}
          onChange={(v) => onChange({ cierreVert: v })}
        />
      </Section>

      {/* 2b. PESO DE CADENA — no aplica a la vertical (lleva su peso VER propio). */}
      {!esVerticalCat && pesosDisponibles.length > 0 && (
        <Section title="Peso de cadena">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Peso</span>
            <select
              className="flex-1 min-w-[200px] rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
              value={pano.codPeso || ''}
              onChange={(e) => onChange({ codPeso: e.target.value })}
            >
              <option value="">— Sin peso —</option>
              {pesosDisponibles.map((c) => (
                <option key={c.cod} value={c.cod as string}>
                  {etiquetaCadena(c)}
                </option>
              ))}
            </select>
          </div>
        </Section>
      )}

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

      {/* 4. COLORES ACCESORIOS (detalle por pieza; el control único de
          "Color accesorios" de arriba pinta los tres de una vez). */}
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
        {cenefaFijaOvalada ? (
          /* La categoría ya trae la cenefa ovalada: no se elige el tipo. */
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Tipo</span>
            <span className="rounded border border-accent/50 bg-accent/20 px-2 py-1 text-[0.7rem] text-accent">
              Ovalada — fija por categoría
            </span>
          </div>
        ) : (
          <RadioRow
            label="Tipo"
            value={pano.cenefa || 'No'}
            options={opcionesCenefa}
            onChange={(v) =>
              onChange({
                cenefa: v,
                // Ovalada arranca CON TIRA por default; el resto sin tira.
                cenefaTira: v === 'Ovalada' ? 'CON TIRA' : 'SIN TIRA',
              })
            }
          />
        )}
        {(pano.cenefa === 'Ovalada' || cenefaFijaOvalada) && (
          <>
            <RadioRow
              label="Tira"
              value={pano.cenefaTira || (cenefaEsOvalada ? 'CON TIRA' : 'SIN TIRA')}
              options={OPCIONES_CENEFA_TIRA}
              onChange={(v) => onChange({ cenefaTira: v })}
            />
            <RadioRow
              label="Color tapa"
              value={pano.colorTapa || ''}
              options={OPCIONES_COLOR_TAPA_OVALADA}
              onChange={(v) => onChange({ colorTapa: v })}
            />
            <RadioRow
              label="Bracket"
              value={pano.bracketTipo || 'CORTO'}
              options={OPCIONES_BRACKET_TIPO}
              onChange={(v) => onChange({ bracketTipo: v })}
            />
          </>
        )}
        {esCenefaCuadrada(pano.cenefa) && (
          <>
            <RadioRow
              label="Tapas"
              value={!pano.cenefaTapa || pano.cenefaTapa === 'SIN_TAPA' ? 'MURO_MURO' : pano.cenefaTapa}
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

      {/* 5a. MATERIAL DE INSTALACIÓN — tipo de muro (define tarugos de vulcanita)
          y posición (techo/pared, cambia los tarugos de la cenefa ovalada). */}
      <Section title="Material de instalación">
        <RadioRow
          label="Tipo"
          value={pano.materialTipo || ''}
          options={OPCIONES_MATERIAL_TIPO}
          onChange={(v) => onChange({ materialTipo: v })}
        />
        <RadioRow
          label="Posición"
          value={pano.superficie || ''}
          options={OPCIONES_SUPERFICIE}
          onChange={(v) => onChange({ superficie: v })}
        />
      </Section>

      {/* 5a-bis. SUPLEMENTOS — opcional; cantidad auto (roller 2 / cenefa 1 por bracket). */}
      <Section title="Suplementos">
        <RadioRow
          label="Tipo"
          value={pano.suplementoTipo || ''}
          options={OPCIONES_SUPLEMENTO as unknown as readonly { value: string; label: string }[]}
          onChange={(v) => onChange({ suplementoTipo: v })}
        />
        {pano.suplementoTipo && (
          <div className="flex items-end gap-2">
            <div className="max-w-[150px]">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={0}
                value={pano.suplementoCant ?? suplementoAuto}
                onChange={(e) => onChange({ suplementoCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            {typeof pano.suplementoCant === 'number' && (
              <button
                type="button"
                onClick={() => onChange({ suplementoCant: undefined })}
                className="mb-2 text-[0.7rem] text-muted-foreground hover:text-foreground"
                title={`Auto: ${suplementoAuto}`}
              >
                ↺ auto
              </button>
            )}
          </div>
        )}
      </Section>

      {/* 5b. SISTEMA DE OSCURIDAD (Soft Light / Oscuranti / Dark) */}
      {familia && (
        <Section title="Sistema de oscuridad — perfiles">
          <RadioRow
            label="Instalación"
            value={varianteOscuridad}
            options={OPCIONES_VARIANTE_OSCURIDAD as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ oscuridadVariante: v || 'INTERNO' })}
          />
          {componentesOsc.length > 0 && (
            <div className="rounded border border-border/60 bg-background/40 p-2 text-[0.7rem]">
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Medidas de corte (cm)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {componentesOsc.map((c) => (
                  <div key={c.componente} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{c.componente}</span>
                    <span className="font-mono text-foreground">{c.medidaCm}</span>
                  </div>
                ))}
                {colorPesoInfOscuridad && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Color peso inf.</span>
                    <span className="font-mono text-foreground">{colorPesoInfOscuridad}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1">
            {PERFILES_OSCURIDAD.map((p) => {
              const field = PERFIL_FIELD[p.key];
              const medidaField = PERFIL_MEDIDA_FIELD[p.key];
              const checked = !!pano[field];
              const medida = medidaPerfilOscuridad(
                familia,
                varianteOscuridad,
                p.key,
                anchoCmOsc,
                altoCmOsc,
              );
              const override = pano[medidaField] as number | undefined;
              const colorPerfil = colorPerfilDesdeAdicional(
                PERFIL_TIPO_ADICIONAL[p.key],
                adicionalesFase0,
                categoria,
              );
              return (
                <PerfilToggle
                  key={p.key}
                  label={p.label}
                  medida={medida}
                  override={typeof override === 'number' ? override : undefined}
                  colorPerfil={colorPerfil}
                  checked={checked}
                  onToggle={(v) => onChange({ [field]: v } as Partial<Pano>)}
                  onMedidaChange={(v) => onChange({ [medidaField]: v } as Partial<Pano>)}
                />
              );
            })}
          </div>
          {/* Soft / Dark (legacy) vive dentro de la sección de oscuridad. */}
          <RadioRow
            label="Soft / Dark"
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
      )}

      {/* 5c. BEEBLACK — cierre horizontal */}
      {esBeeblack && (
        <Section title="BEEBLACK — cierre horizontal">
          <RadioRow
            label="Instalación"
            value={varianteBeeblack}
            options={OPCIONES_VARIANTE_BEEBLACK as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ beeblackVariante: v || 'INTERNO' })}
          />
          {componentesBb.length > 0 && (
            <div className="rounded border border-border/60 bg-background/40 p-2 text-[0.7rem]">
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                Medidas de corte (cm)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {componentesBb.map((c) => (
                  <div key={c.componente} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{c.componente}</span>
                    <span className="font-mono text-foreground">{c.medidaCm}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1">
            {BEEBLACK_FIJO_ROWS.map((row) => {
              const medida =
                anchoCmBb > 0 && altoCmBb > 0
                  ? medidaComponenteBeeblack(
                      varianteBeeblack,
                      row.calcKey,
                      anchoCmBb,
                      altoCmBb,
                      togglesBeeblack,
                    )
                  : 0;
              const override = pano[row.field] as number | undefined;
              return (
                <MedidaEditableRow
                  key={row.key}
                  label={row.label}
                  medida={medida}
                  override={typeof override === 'number' ? override : undefined}
                  onMedidaChange={(v) => onChange({ [row.field]: v } as Partial<Pano>)}
                />
              );
            })}
            {togglesBeeblackUi.map((t) => {
              const field = BEEBLACK_TOGGLE_FIELD[t.key];
              const checked = !!pano[field];
              if (t.key === 'manillaIzq' || t.key === 'manillaDer') {
                const medidaField = BEEBLACK_MANILLA_MEDIDA_FIELD[t.key];
                const medida =
                  anchoCmBb > 0 && altoCmBb > 0
                    ? medidaComponenteBeeblack(
                        varianteBeeblack,
                        t.key,
                        anchoCmBb,
                        altoCmBb,
                        togglesBeeblack,
                      )
                    : 0;
                const override = pano[medidaField] as number | undefined;
                return (
                  <PerfilToggle
                    key={t.key}
                    label={t.label}
                    medida={medida}
                    override={typeof override === 'number' ? override : undefined}
                    checked={checked}
                    onToggle={(v) => onChange({ [field]: v } as Partial<Pano>)}
                    onMedidaChange={(v) => onChange({ [medidaField]: v } as Partial<Pano>)}
                  />
                );
              }
              return (
                <div
                  key={t.key}
                  className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1"
                >
                  <span className="text-[0.72rem] text-foreground">{t.label}</span>
                  <button
                    type="button"
                    onClick={() => onChange({ [field]: !checked } as Partial<Pano>)}
                    aria-pressed={checked}
                    className={cn(
                      'w-12 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide transition-colors',
                      checked
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-border bg-card text-muted-foreground hover:bg-card',
                    )}
                  >
                    {checked ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 8. ORDEN DOBLE — dúo, dual, o dato guardado de OT vieja. En dual el
          orden es inherente (2 telas): se oculta el checkbox "Es doble" y se
          muestra directo el selector (default SCR al vidrio). */}
      {(esDuo || pano.dual || pano.ordenDoble) && (
        <Section title="Orden doble (dual / duo)">
          {!pano.dual && (
            <Checkbox
              label="Es doble"
              checked={!!pano.ordenDoble}
              onChange={(v) => onChange({ ordenDoble: v })}
            />
          )}
          {(pano.dual || pano.ordenDoble) && (
            <RadioRow
              label="Orden"
              value={pano.ordenDobleOpcion || 'SCR_VID_BK'}
              options={OPCIONES_ORDEN_DOBLE as unknown as readonly { value: string; label: string }[]}
              onChange={(v) => onChange({ ordenDobleOpcion: v })}
            />
          )}
        </Section>
      )}

      {/* 9. MECANISMO — con selector de tipo Simple/Dual */}
      {!ocultarMecanismo && (
        <Section title="Mecanismo">
          <RadioRow
            label="Tipo"
            value={pano.dual ? 'DUAL' : 'SIMPLE'}
            options={OPCIONES_TIPO_MECANISMO as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ dual: v === 'DUAL' })}
          />
          {pano.dual && (
            <RadioRow
              label="Lado"
              value={pano.dualLado || ''}
              options={OPCIONES_DUAL_LADO}
              onChange={(v) => onChange({ dualLado: v })}
            />
          )}
          <RadioRow
            label=""
            value={pano.mecanismo || ''}
            options={opcionesMecanismo}
            onChange={(v) => onChange({ mecanismo: v })}
          />
          {mecanismoFijoNota && !pano.dual && (
            <p className="text-[0.7rem] text-amber-500">{mecanismoFijoNota}</p>
          )}
        </Section>
      )}

      {/* 11. MOTOR — modelo (todos inalámbricos hoy), domótica y adicionales.
          DOM41 no se ofrece con cenefa ovalada (regla F15). */}
      {(esMotorCat || !!pano.motorModelo || !!pano.motorTipo || !!pano.ladoMotor) && (
        <Section title="Motor">
          <RadioRow
            label="Modelo"
            value={pano.motorModelo || ''}
            options={opcionesMotorModelo as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onChange({ motorModelo: v })}
          />
          <RadioRow
            label="Domótica"
            value={pano.motorDomotica ? 'SI' : 'NO'}
            options={[{ value: 'NO', label: 'Sin domótica' }, { value: 'SI', label: 'Con domótica' }]}
            onChange={(v) => onChange({ motorDomotica: v === 'SI' })}
          />
          <div className="flex flex-wrap items-end gap-4 pt-1">
            <div className="max-w-[150px]">
              <Label>Controles adicionales</Label>
              <Input
                type="number"
                min={0}
                value={pano.motorControlAdicCant ?? 0}
                onChange={(e) => onChange({ motorControlAdicCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="max-w-[150px]">
              <Label>Hub USB adicionales</Label>
              <Input
                type="number"
                min={0}
                value={pano.motorHubUsbCant ?? 0}
                onChange={(e) => onChange({ motorHubUsbCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>
          <RadioRow
            label="Lado motor"
            value={pano.ladoMotor || ''}
            options={OPCIONES_LADO_MOTOR}
            onChange={(v) => onChange({ ladoMotor: v })}
          />
        </Section>
      )}

      {/* 12. SOFT / DARK — escape legacy: fuera de oscuridad solo si hay dato */}
      {softDarkLegacy && (
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
      )}

      {/* 13. TUBERÍA */}
      <Section title="Tubería">
        <RadioRow
          label=""
          value={pano.tuberia || ''}
          options={opcionesTuberia}
          onChange={(v) => onChange({ tuberia: v })}
        />
      </Section>

      {/* 14. NOTAS DE TERRENO — agrupa retiro/material/cortes/comentarios.
          Colapsada por defecto; lo anotado sale en la hoja de INVENTARIO. */}
      <SeccionColapsable
        title="Notas de terreno"
        badge={tieneNotasTerreno(pano) ? 'con notas' : undefined}
      >
        <div className="max-w-[160px]">
          <Label>Retiro de cortinas</Label>
          <Input
            type="number"
            min={0}
            value={pano.retiro ?? 0}
            onChange={(e) => onChange({ retiro: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <RadioRow
          label="Cortes"
          value={pano.cortes || ''}
          options={OPCIONES_CORTES}
          onChange={(v) => onChange({ cortes: v })}
        />
        <Checkbox
          label="Ver video de terreno"
          checked={!!pano.verVideo}
          onChange={(v) => onChange({ verVideo: v })}
        />
        <RadioRow
          label="Relación marco"
          value={pano.relacionMarco || ''}
          options={OPCIONES_RELACION_MARCO}
          onChange={(v) => onChange({ relacionMarco: v })}
        />
        {/* Campo legado: solo se muestra si la OT ya lo traía escrito
            (el dato nuevo del dúo va en "Cierre de altura (cm)"). */}
        {!!pano.alturaCierre && (
          <div>
            <Label>Cerrada a altura de (texto viejo)</Label>
            <Input
              value={pano.alturaCierre || ''}
              onChange={(e) => onChange({ alturaCierre: e.target.value })}
              placeholder="Ej: 1.20m, ras de piso…"
            />
          </div>
        )}
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
            className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
          />
        </div>
      </SeccionColapsable>
    </div>
  );
}

/** ¿El paño tiene alguna nota de terreno anotada? (para el badge).
 *  superficie/materialTipo tienen su propia sección "Material de instalación". */
function tieneNotasTerreno(p: Pano): boolean {
  return !!(
    (p.retiro ?? 0) > 0 ||
    (p.cortes && p.cortes !== 'Nada') ||
    p.verVideo ||
    (p.relacionMarco && p.relacionMarco !== 'N/A') ||
    p.alturaCierre ||
    p.cotizarConSin ||
    p.suplementos ||
    p.comentarioFinal
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SeccionColapsable({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-[0.72rem] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[0.6rem] normal-case tracking-normal text-amber-400">
              {badge}
            </span>
          )}
        </span>
        <span aria-hidden>{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && <div className="mt-2 space-y-2">{children}</div>}
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
      {label && <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">{label}</span>}
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
                  ? 'border-accent/50 bg-accent/20 text-accent'
                  : 'border-border bg-card text-foreground hover:bg-card',
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

function MedidaEditableRow({
  label,
  medida,
  override,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          step="0.1"
          value={valorInput}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onMedidaChange(undefined);
            const n = parseFloat(raw);
            onMedidaChange(Number.isFinite(n) ? n : undefined);
          }}
          className={cn(
            'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
            editado ? 'border-amber-500/60' : 'border-border',
          )}
          title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
        />
        {editado && (
          <button
            type="button"
            onClick={() => onMedidaChange(undefined)}
            title={`Restablecer a ${medida}`}
            className="text-[0.7rem] text-muted-foreground hover:text-foreground"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}

function PerfilToggle({
  label,
  medida,
  override,
  colorPerfil,
  checked,
  onToggle,
  onMedidaChange,
}: {
  label: string;
  medida: number;
  override?: number;
  colorPerfil?: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
  onMedidaChange: (v: number | undefined) => void;
}) {
  const editado = typeof override === 'number';
  const valorInput = editado ? override : medida > 0 ? medida : '';
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-border/60 bg-card/40 px-2 py-1">
      <span className="text-[0.72rem] text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {colorPerfil && (
          <span
            className={cn(
              'min-w-[52px] text-center text-[0.65rem] uppercase tracking-wide',
              checked ? 'text-muted-foreground' : 'text-muted-foreground/40',
            )}
            title="Color desde adicionales Fase 0"
          >
            {colorPerfil}
          </span>
        )}
        {checked ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.1"
              value={valorInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return onMedidaChange(undefined);
                const n = parseFloat(raw);
                onMedidaChange(Number.isFinite(n) ? n : undefined);
              }}
              className={cn(
                'h-6 w-[64px] rounded border bg-card px-1 text-right font-mono text-[0.72rem] text-foreground',
                editado ? 'border-amber-500/60' : 'border-border',
              )}
              title={editado ? `Calculada: ${medida}` : 'Medida calculada (editable)'}
            />
            {editado && (
              <button
                type="button"
                onClick={() => onMedidaChange(undefined)}
                title={`Restablecer a ${medida}`}
                className="text-[0.7rem] text-muted-foreground hover:text-foreground"
              >
                ↺
              </button>
            )}
          </div>
        ) : (
          <span className="min-w-[48px] text-right font-mono text-[0.72rem] text-muted-foreground/40">
            {medida > 0 ? medida : '—'}
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(!checked)}
          aria-pressed={checked}
          className={cn(
            'w-12 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide transition-colors',
            checked
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-border bg-card text-muted-foreground hover:bg-card',
          )}
        >
          {checked ? 'ON' : 'OFF'}
        </button>
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
    <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-card accent-indigo-500"
      />
      {label}
    </label>
  );
}
