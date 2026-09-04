// Cuerpo de cada paso del wizard de terreno. Cada bloque edita los MISMOS
// campos que la ficha clásica y despacha por el mismo `onPano`/`onVentana`
// (que en la página son `actualizarPano`/`actualizarVentana`, con todas sus
// cascadas), así que las dos vistas guardan exactamente lo mismo.
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioRow } from '@/components/cotizador/editorPano/controles';
import { ProductoSelectorFase2 } from '@/components/cotizador/ProductoSelectorFase2';
import {
  OPCIONES_BRACKET_TIPO,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CENEFA_TIRA,
  OPCIONES_CIERRE_VERT,
  OPCIONES_CORTES,
  OPCIONES_LADO_MOTOR,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MONTAJE_BASE,
  OPCIONES_MOTOR_MODELO,
  OPCIONES_PERFORACION,
  OPCIONES_SUPERFICIE,
  OPCIONES_SUPERFICIE_PERFIL,
  OPCIONES_SUPLEMENTO,
  OPCIONES_TIPO_TELA,
  OPCIONES_VARIANTE_OSCURIDAD,
  PERFILES_LADO,
  esCenefaCuadrada,
  parcheSuperficiePerfil,
  perfilesOscuridadDePano,
  type SuperficiePerfilOscuridad,
} from '@/modules/cotizador/fase2';
import {
  aplicarDefaultsPerfiles,
  esFamiliaSoftLight,
  familiaOscuridadConDiametro,
  medidaPerfilOscuridad,
  montajeBaseDisponible,
  normalizarMontajeBase,
  normalizarVarianteOscuridad,
  type PerforacionPerfil,
  type SuperficiePerfilKey,
} from '@/modules/descuentos/reglas-oscuridad';
import {
  codigoTuberiaDeChip,
  diametroDeCodigoTubo,
} from '@/modules/descuentos/reglas-tuberia';
import { CIERRES_BEEBLACK, esCategoriaBeeblack } from '@/modules/descuentos/reglas-beeblack';
import {
  CENEFA_OVALADA_SISTEMA,
  parcheAcciona,
  parcheCadena,
  parcheCenefaSoftLight,
  parcheCenefaTipo,
  parcheColorAccesorios,
  parcheTela,
  parcheVarianteBeeblack,
} from '@/modules/cotizador/wizard/parches';
import {
  cenefaCuadradaTapasFijas,
  llevaCenefaCuadradaImplicita,
  llevaCenefaOvaladaImplicita,
  opcionesCenefa,
} from '@/modules/cotizador/insumosCortina';
import type { FormulasFamilias } from '@/modules/descuentos/formulasFamilias';
import { categoriasFase1ConTipos } from '@/modules/cotizador/categorias';
import {
  etiquetaCadena,
  cadenasRoller,
  pesosSeleccionables,
  topesSeleccionables,
  type CadenaInsumo,
} from '@/modules/cotizador/cadenas';
import { colorAccesorioCorto } from '@/modules/cotizador/fase0-sync';
import { esCategoriaVertical } from '@/modules/descuentos/reglas-mecanismo';
import { coloresParaUso, opcionesColorConGuardado } from '@/modules/descuentos/coloresAccesorio';
import { colorAccesoriosDePano } from '@/modules/descuentos/chips';
import { esCenefaOvalada } from '@/modules/cotizador/insumosCortina';
import { PESO_ROLLER_POR_COLOR } from '@/modules/descuentos/codigos-estructura';
import { panoLlevaMotor, colorAccesorioCanonico } from '@/modules/cotizador/wizard/cortinaViz';
import type { IdPaso } from '@/modules/cotizador/wizard/pasos';
import type { ReglasSeleccion } from '@/modules/descuentos/reglasSeleccion';
import type { CatalogoProductos, Pano, Ventana } from '@/modules/cotizador/types';

const CARGADOR_DOM38 = [
  { value: 'NINGUNO', label: 'No lleva' },
  { value: 'DOM43', label: 'Hub domótica (DOM43)' },
  { value: 'DOM33', label: 'Adaptador (DOM33)' },
];
const CARGADOR_DOM41 = [
  { value: 'NINGUNO', label: 'No lleva' },
  { value: 'DOM03', label: 'HUB USB (DOM03)' },
  { value: 'DOM33', label: 'Adaptador (DOM33)' },
];

export type PropsPaso = {
  paso: IdPaso;
  ventana: Ventana;
  pano: Pano;
  panoIdx: number;
  esDual: boolean;
  esDuo: boolean;
  catalogo: CatalogoProductos;
  reglas: ReglasSeleccion;
  cadenas: CadenaInsumo[];
  pesos: CadenaInsumo[];
  topes: CadenaInsumo[];
  opcionesMecanismo: readonly string[];
  opcionesTuberia: readonly string[];
  notaMecanismo?: string;
  lineaB: boolean;
  /** Fórmulas de corte editadas en Admin (las usan las medidas de los perfiles). */
  formulas?: FormulasFamilias;
  onVentana: (patch: Partial<Ventana>) => void;
  onPano: (patch: Partial<Pano>) => void;
  onCategoria: (categoria: string) => void;
};

const OPCIONES_VARIANTE_BEEBLACK = [
  { value: 'INTERNO', label: 'Interno' },
  { value: 'SEMI', label: 'Semi' },
  { value: 'EXTERNO', label: 'Externo' },
] as const;

/** Fila de dato calculado: lo que el sistema resuelve solo y conviene mostrar. */
function Derivado({ label, valor, nota }: { label: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">{label}</span>
      <span className="rounded border border-border bg-card px-2 py-1 font-mono text-[0.7rem] text-foreground">
        {valor}
      </span>
      {nota && <span className="text-[0.68rem] text-muted-foreground">{nota}</span>}
    </div>
  );
}

export function CuerpoPaso(props: PropsPaso) {
  const { paso, ventana, pano, panoIdx, esDual, esDuo, catalogo, reglas, onPano, onVentana } = props;

  const coloresAcc = opcionesColorConGuardado(
    coloresParaUso('accesorio', reglas.colores),
    colorAccesorioCorto(colorAccesoriosDePano(pano, ventana.color)),
  );
  const conMotor = panoLlevaMotor(pano);
  const cenefaOvalada = esCenefaOvalada(pano.cenefa as string, ventana.categoria, reglas.tipos);

  switch (paso) {
    case 'medidas':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Ubicación</Label>
              <Input
                value={ventana.ubicacion}
                onChange={(e) => onVentana({ ubicacion: e.target.value })}
                placeholder="Living, Dormitorio 1…"
                autoFocus
              />
            </div>
            <div>
              <Label>Tipo de cortina</Label>
              <select
                value={ventana.categoria}
                onChange={(e) => props.onCategoria(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-2 py-2 text-sm"
              >
                <option value="">— Selecciona —</option>
                {categoriasFase1ConTipos(reglas.tipos).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label>Ancho (m)</Label>
              <Input
                type="number"
                step="0.001"
                value={pano.ancho === 0 ? '' : String(pano.ancho ?? '')}
                onChange={(e) => onPano({ ancho: e.target.value })}
                placeholder="1,855"
              />
            </div>
            <div>
              <Label>Alto (m)</Label>
              <Input
                type="number"
                step="0.001"
                value={pano.alto === 0 ? '' : String(pano.alto ?? '')}
                onChange={(e) => onPano({ alto: e.target.value })}
                placeholder="2,30"
              />
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={ventana.cantidad || 1}
                onChange={(e) => onVentana({ cantidad: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>
          <RadioRow
            label="Armado"
            value={pano.armado || ''}
            options={['Interno', 'Externo']}
            onChange={(v) => onPano({ armado: v })}
          />
          {esCategoriaBeeblack(ventana.categoria) && (
            <div className="space-y-1">
              <RadioRow
                label="Variante"
                value={(pano.beeblackVariante as string) || ''}
                options={OPCIONES_VARIANTE_BEEBLACK as unknown as readonly { value: string; label: string }[]}
                // La instalación se reajusta sola: cada variante tiene su lista.
                onChange={(v) => onPano(parcheVarianteBeeblack(v, pano.beeblackInstalacion))}
              />
              <p className="text-[0.68rem] text-muted-foreground">
                Del beeblack TODAS las medidas salen de la variante: sin ella no hay componentes.
              </p>
            </div>
          )}
        </div>
      );

    case 'soportes':
      return (
        <div className="space-y-3">
          <RadioRow
            label="Color"
            value={colorAccesorioCorto(colorAccesoriosDePano(pano, ventana.color))}
            options={coloresAcc}
            // Un solo control pinta las tres piezas, como en la ficha.
            onChange={(v) => onPano(parcheColorAccesorios(v))}
          />
          <RadioRow
            label="Material"
            value={pano.materialTipo || ''}
            options={OPCIONES_MATERIAL_TIPO}
            onChange={(v) => onPano({ materialTipo: v })}
          />
          <RadioRow
            label="Superficie"
            value={pano.superficie || ''}
            options={OPCIONES_SUPERFICIE}
            onChange={(v) => onPano({ superficie: v })}
          />
          <RadioRow
            label="Marco"
            value={pano.relacionMarco || ''}
            options={[
              { value: 'Dentro', label: 'Dentro del marco' },
              { value: 'Fuera', label: 'Fuera del marco' },
              { value: 'N/A', label: 'No aplica' },
            ]}
            onChange={(v) => onPano({ relacionMarco: v })}
          />
          <p className="text-[0.68rem] text-muted-foreground">
            El material define los tarugos que se piden a bodega; la superficie, el
            bracket de la cenefa.
          </p>
        </div>
      );

    case 'tubo':
      return (
        <div className="space-y-2">
          <RadioRow
            label="Tubería"
            value={pano.tuberia || ''}
            options={props.opcionesTuberia}
            onChange={(v) => onPano({ tuberia: v })}
          />
          {props.opcionesTuberia.length === 1 && (
            <p className="text-[0.68rem] text-amber-500">
              El ancho de esta cortina fija el tubo: no hay otra opción compatible.
            </p>
          )}
        </div>
      );

    case 'mecanismo':
      return (
        <div className="space-y-2">
          <RadioRow
            label="Kit"
            value={pano.mecanismo || ''}
            options={props.opcionesMecanismo}
            onChange={(v) => onPano({ mecanismo: v })}
          />
          {props.notaMecanismo && (
            <p className="text-[0.68rem] text-amber-500">{props.notaMecanismo}</p>
          )}
          {esDual && (
            <RadioRow
              label="Lado"
              value={pano.dualLado || ''}
              options={['DERECHO', 'IZQUIERDO', 'MIXTO']}
              onChange={(v) => onPano({ dualLado: v })}
            />
          )}
        </div>
      );

    case 'accionamiento': {
      // La VERTICAL no lleva cadena de roller: lo único que se pregunta es el
      // Cierre (lado del mando de las lamas), el MISMO radio de la ficha con
      // Vertical/Medio incluidos. Llega a Fase 3 como DIRECC. CAD/CIERRE.
      if (esCategoriaVertical(ventana.categoria)) {
        return (
          <div className="space-y-2">
            <RadioRow
              label="Cierre"
              value={pano.cierreVert || ''}
              options={
                pano.cierreVert &&
                !(OPCIONES_CIERRE_VERT as readonly string[]).includes(pano.cierreVert)
                  ? [...OPCIONES_CIERRE_VERT, pano.cierreVert]
                  : [...OPCIONES_CIERRE_VERT]
              }
              onChange={(v) => onPano({ cierreVert: v })}
            />
            <p className="text-[0.68rem] text-muted-foreground">
              La cadena de mando de la vertical es propia (no la de roller) y cuelga del lado del
              cierre.
            </p>
          </div>
        );
      }
      // El BEEBLACK no lleva cadena ni motor: se abre y cierra con la manilla.
      // Lo único que se pregunta es el cierre — hacia dónde corre el acordeón —
      // que es de la VENTANA y llega a Fase 3 como DIRECC. CAD/CIERRE.
      if (esCategoriaBeeblack(ventana.categoria)) {
        const cierre = ventana.direccion || '';
        return (
          <div className="space-y-2">
            <RadioRow
              label="Cierre"
              value={cierre}
              options={
                cierre && !(CIERRES_BEEBLACK as readonly string[]).includes(cierre)
                  ? [...CIERRES_BEEBLACK, cierre]
                  : [...CIERRES_BEEBLACK]
              }
              onChange={(v) => onVentana({ direccion: v })}
            />
            <p className="text-[0.68rem] text-muted-foreground">
              DE ARRIBA ABAJO gira la cortina 90°: las lamas se cuentan sobre el alto y el corte
              intercambia ancho y alto.
            </p>
          </div>
        );
      }
      const cargadorOpts =
        (pano.motorModelo || '').toUpperCase() === 'DOM38' ? CARGADOR_DOM38 : CARGADOR_DOM41;
      const cadenasDisponibles = cadenasRoller(props.cadenas, {}, reglas.cadenas);
      const pesosDisponibles = pesosSeleccionables(props.pesos);
      const topesDisponibles = topesSeleccionables(props.topes);
      return (
        <div className="space-y-3">
          <RadioRow
            label="Acciona"
            value={conMotor ? 'MOTOR' : 'CADENA'}
            options={[
              { value: 'CADENA', label: 'Con cadena' },
              { value: 'MOTOR', label: 'Con motor' },
            ]}
            // Pasar a motor limpia la cadena: el kit ya no la lleva.
            onChange={(v) =>
              onPano(parcheAcciona(v, { motorModelo: pano.motorModelo, cenefaOvalada }))
            }
          />
          {conMotor ? (
            <>
              <RadioRow
                label="Modelo"
                value={pano.motorModelo || ''}
                options={
                  cenefaOvalada
                    ? OPCIONES_MOTOR_MODELO.filter((o) => o.value !== 'DOM41')
                    : OPCIONES_MOTOR_MODELO
                }
                onChange={(v) => onPano({ motorModelo: v })}
              />
              <RadioRow
                label="Lado"
                value={pano.ladoMotor || ''}
                options={OPCIONES_LADO_MOTOR}
                onChange={(v) => onPano({ ladoMotor: v })}
              />
              <RadioRow
                label="Cargador"
                value={pano.motorCargador || 'NINGUNO'}
                options={cargadorOpts}
                onChange={(v) => onPano({ motorCargador: v || 'NINGUNO' })}
              />
              <div className="flex flex-wrap items-end gap-4">
                <div className="max-w-[150px]">
                  <Label>Controles</Label>
                  <Input
                    type="number"
                    min={0}
                    value={pano.motorControlAdicCant ?? 0}
                    onChange={(e) =>
                      onPano({ motorControlAdicCant: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </div>
                <div className="max-w-[150px]">
                  <Label>Hub adicionales</Label>
                  <Input
                    type="number"
                    min={0}
                    value={pano.motorHubUsbCant ?? 0}
                    onChange={(e) => onPano({ motorHubUsbCant: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {cadenasDisponibles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Cadena</span>
                  <select
                    className="min-w-[220px] flex-1 rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
                    value={pano.codCadena || ''}
                    onChange={(e) =>
                      onPano(parcheCadena(e.target.value, props.cadenas, reglas.cadenas))
                    }
                  >
                    <option value="">— Sin cadena —</option>
                    {cadenasDisponibles.map((c) => (
                      <option key={c.cod} value={c.cod as string}>
                        {etiquetaCadena(c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <RadioRow
                label="Posición"
                value={pano.cierreVert || ''}
                options={['Izquierda', 'Derecha']}
                onChange={(v) => onPano({ cierreVert: v })}
              />
              {pesosDisponibles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Peso</span>
                  <select
                    className="min-w-[220px] flex-1 rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
                    value={pano.codPeso || ''}
                    onChange={(e) => onPano({ codPeso: e.target.value })}
                  >
                    <option value="">— Sin peso —</option>
                    {pesosDisponibles.map((c) => (
                      <option key={c.cod} value={c.cod as string}>
                        {etiquetaCadena(c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* Topes: se ponen solos por el color de accesorios; el selector
                  está para el caso raro en que haya que cambiarlos. Van 2. */}
              {topesDisponibles.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[80px] text-[0.72rem] text-muted-foreground">Topes (2)</span>
                  <select
                    className="min-w-[220px] flex-1 rounded border border-border bg-card px-2 py-1 text-[0.72rem] text-foreground"
                    value={pano.codTope || ''}
                    onChange={(e) => onPano({ codTope: e.target.value })}
                  >
                    <option value="">— Por color de accesorios —</option>
                    {topesDisponibles.map((c) => (
                      <option key={c.cod} value={c.cod as string}>
                        {etiquetaCadena(c)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    case 'tela':
      return (
        <div className="space-y-3">
          <div>
            <Label>{esDual ? `Tela del paño ${panoIdx + 1}` : 'Tela'}</Label>
            <ProductoSelectorFase2
              value={esDual ? pano.codInt || '' : ventana.codInt}
              catalogo={catalogo}
              onSelect={(sel) => {
                const parche = parcheTela(sel, catalogo, esDual);
                if (parche.ventana) onVentana(parche.ventana);
                if (parche.pano) onPano(parche.pano);
              }}
            />
            {esDual && (
              <p className="mt-1 text-[0.68rem] text-muted-foreground">
                {panoIdx === 0
                  ? 'El paño 1 es el rollo que va al vidrio: normalmente la screen.'
                  : 'El paño 2 es el rollo de adentro: normalmente el blackout.'}{' '}
                Cada uno lleva su propia tela.
              </p>
            )}
          </div>
          <RadioRow
            label="Tipo"
            value={pano.tipoTela || ''}
            options={OPCIONES_TIPO_TELA}
            onChange={(v) => onPano({ tipoTela: v })}
          />
          <p className="text-[0.68rem] text-muted-foreground">
            El tipo cambia cómo se ve la cortina en el dibujo: screen deja pasar luz,
            blackout la tapa y el dúo va en bandas.
          </p>
        </div>
      );

    case 'peso': {
      const colorAcc = colorAccesorioCanonico(colorAccesoriosDePano(pano, ventana.color));
      const codPesoBarra = PESO_ROLLER_POR_COLOR[colorAcc];
      return (
        <div className="space-y-3">
          {codPesoBarra ? (
            <Derivado
              label="Peso inferior"
              valor={codPesoBarra}
              nota={`sale del color de accesorios (${colorAcc.toLowerCase()})`}
            />
          ) : (
            <p className="text-[0.68rem] text-amber-500">
              Elige el color de accesorios para que salga el código del peso inferior.
            </p>
          )}
          {esDuo && (
            <div className="max-w-[180px]">
              <Label>Altura de cierre (cm)</Label>
              <Input
                type="number"
                step="0.1"
                min={0}
                value={pano.cierreAlturaCm === 0 ? '' : String(pano.cierreAlturaCm ?? '')}
                onChange={(e) => onPano({ cierreAlturaCm: e.target.value })}
                placeholder="medida de terreno"
              />
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <div className="max-w-[130px]">
              <Label>Manillas</Label>
              <Input
                type="number"
                min={0}
                value={pano.manillaCant ?? 0}
                onChange={(e) => onPano({ manillaCant: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            {(pano.manillaCant ?? 0) > 0 && (
              <RadioRow
                label="Color"
                value={pano.manillaColor || ''}
                options={opcionesColorConGuardado(
                  coloresParaUso('manilla', reglas.colores),
                  pano.manillaColor as string,
                )}
                onChange={(v) => onPano({ manillaColor: v })}
              />
            )}
          </div>
        </div>
      );
    }

    case 'perfiles': {
      // Versión compacta de la sección «Sistema de oscuridad — perfiles» de la
      // ficha: variante + instalación y perforación por perfil. Los separadores
      // y las medidas especiales quedan en la vista Ficha (no bloquean el gate
      // salvo que alguien active un separador sin medida — el resumen lo avisa).
      const categoria = ventana.categoria || '';
      const familia = familiaOscuridadConDiametro(
        categoria,
        pano.cenefa,
        diametroDeCodigoTubo(codigoTuberiaDeChip(pano.tuberia as string), reglas.tuberia),
        reglas.tipos,
      );
      if (!familia) return null;
      const variante = normalizarVarianteOscuridad(
        (pano.oscuridadVariante as string) ?? ventana.oscuridadVariante ?? ventana.sentido,
        'INTERNO',
      );
      const eff = aplicarDefaultsPerfiles(perfilesOscuridadDePano(pano), familia, variante);
      const anchoCm = (parseFloat(String(pano.ancho ?? 0)) || 0) * 100;
      const altoCm = (parseFloat(String(pano.alto ?? ventana.alto ?? 0)) || 0) * 100;
      const montajeBase = normalizarMontajeBase(pano.perfilInfMontaje) ?? 'DENTRO';
      const mostrarMontaje = montajeBaseDisponible(familia, variante);
      // Soft light SEMI: el perfil base va SIEMPRE con perforación EXTERNA (fija).
      const perfBaseForzada = esFamiliaSoftLight(familia) && variante === 'SEMI';
      return (
        <div className="space-y-3">
          <RadioRow
            label="Instalación"
            value={variante}
            options={OPCIONES_VARIANTE_OSCURIDAD as unknown as readonly { value: string; label: string }[]}
            onChange={(v) => onPano({ oscuridadVariante: v || 'INTERNO' })}
          />
          <div className="space-y-1">
            {PERFILES_LADO.map((L) => {
              const activo =
                L.side === 'izq' ? eff.izqActivo : L.side === 'der' ? eff.derActivo : eff.infActivo;
              const superficie = pano[L.muro]
                ? 'muro'
                : pano[L.piso]
                  ? 'piso'
                  : pano[L.marco]
                    ? 'marco'
                    : '';
              const perf: PerforacionPerfil | '' =
                (L.side === 'izq' ? eff.izqPerf : L.side === 'der' ? eff.derPerf : eff.infPerf) ??
                '';
              const forzada = L.side === 'inf' && perfBaseForzada;
              const surfaceKey: SuperficiePerfilKey =
                superficie === 'piso' ? L.pisoKey : superficie === 'marco' ? L.marcoKey : L.muroKey;
              const medida =
                superficie && anchoCm > 0 && altoCm > 0
                  ? medidaPerfilOscuridad(
                      familia,
                      variante,
                      surfaceKey,
                      anchoCm,
                      altoCm,
                      L.side === 'inf' ? montajeBase : undefined,
                      props.formulas?.oscuridad,
                    )
                  : 0;
              return (
                <div key={L.side} className="space-y-1 rounded border border-border/60 bg-card/40 px-2 py-1.5">
                  <label className="flex items-center gap-1.5 text-[0.72rem] text-foreground">
                    <input
                      type="checkbox"
                      checked={activo}
                      onChange={(e) =>
                        onPano({
                          [L.activo]: e.target.checked,
                          // Al desactivar, limpia superficie/override para que no
                          // reaparezca una medida vieja — igual que la ficha.
                          ...(e.target.checked
                            ? {}
                            : {
                                [L.muro]: false,
                                [L.piso]: false,
                                [L.marco]: false,
                                [L.muroCm]: undefined,
                                [L.pisoCm]: undefined,
                                [L.marcoCm]: undefined,
                              }),
                        } as Partial<Pano>)
                      }
                    />
                    {L.label}
                  </label>
                  {activo && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 text-[0.68rem]">
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Perf.</span>
                        {forzada ? (
                          <span
                            className="rounded bg-primary/80 px-1.5 py-0.5 text-[0.66rem] uppercase text-primary-foreground"
                            title="Soft light SEMI: perforación del perfil base fija en Externa"
                          >
                            Ext (fija)
                          </span>
                        ) : (
                          OPCIONES_PERFORACION.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => onPano({ [L.perf]: o.value } as Partial<Pano>)}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[0.66rem] uppercase',
                                perf === o.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o.label}
                            </button>
                          ))
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Inst.</span>
                        {OPCIONES_SUPERFICIE_PERFIL.filter(
                          (o) => !o.soloInterno || variante === 'INTERNO' || superficie === o.value,
                        ).map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() =>
                              onPano(parcheSuperficiePerfil(L.side, o.value as SuperficiePerfilOscuridad))
                            }
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[0.66rem]',
                              superficie === o.value
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      {L.side === 'inf' && mostrarMontaje && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Base</span>
                          {OPCIONES_MONTAJE_BASE.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => onPano({ perfilInfMontaje: o.value } as Partial<Pano>)}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[0.66rem]',
                                montajeBase === o.value
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {superficie ? (
                        medida > 0 && (
                          <span className="font-mono text-foreground">{medida} cm</span>
                        )
                      ) : (
                        <span className="text-amber-500">definir instalación</span>
                      )}
                      {!forzada && !perf && (
                        <span className="text-amber-500">definir perforación</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[0.68rem] text-muted-foreground">
            Los separadores y las medidas especiales de cada perfil se ajustan en la vista Ficha.
          </p>
        </div>
      );
    }

    case 'terreno':
      return (
        <div className="space-y-3">
          <RadioRow
            label="Corte"
            value={pano.cortes || ''}
            options={OPCIONES_CORTES}
            onChange={(v) => onPano({ cortes: v })}
          />
          <RadioRow
            label="Suplemento"
            value={pano.suplementoTipo || ''}
            options={OPCIONES_SUPLEMENTO}
            onChange={(v) => onPano({ suplementoTipo: v })}
          />
          <div>
            <Label>Comentario para el taller</Label>
            <textarea
              value={pano.comentarioFinal || ''}
              onChange={(e) => onPano({ comentarioFinal: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm"
              placeholder="Lo que haya que saber antes de instalar."
            />
          </div>
        </div>
      );

    case 'cenefa': {
      // DARK y OSCURANTI llevan cenefa cuadrada POR SISTEMA (implícita, tapas
      // fijas): no hay nada que elegir, solo saber que va.
      if (llevaCenefaCuadradaImplicita(ventana.categoria, reglas.tipos) && !pano.cenefa) {
        return (
          <div className="space-y-3">
            <Derivado
              label="Tipo"
              valor="Cuadrada"
              nota="fija por el sistema de oscuridad — tapas fijas, no se pregunta"
            />
          </div>
        );
      }
      // SOFT LIGHT: siempre lleva cenefa — la OVALADA propia del sistema
      // (primer eslabón de su cadena de corte) o, si se elige, la CUADRADA
      // (familia CC, espejo del DARK con tapas fijas). «No» no existe acá:
      // el taller la corta igual. El dato legacy 'Ovalada' explícito cae a la
      // rama general (pregunta tira/tapa/bracket, igual que el gate).
      const famOscCategoria = familiaOscuridadConDiametro(
        ventana.categoria,
        undefined,
        undefined,
        reglas.tipos,
      );
      const esSoftLight =
        !!famOscCategoria && !llevaCenefaCuadradaImplicita(ventana.categoria, reglas.tipos);
      if (esSoftLight && pano.cenefa !== 'Ovalada') {
        return (
          <div className="space-y-3">
            <RadioRow
              label="Tipo"
              value={
                esCenefaCuadrada(pano.cenefa as string)
                  ? (pano.cenefa as string)
                  : CENEFA_OVALADA_SISTEMA
              }
              options={[CENEFA_OVALADA_SISTEMA, 'Cuadrada a muro', 'Cuadrada a techo']}
              onChange={(v) => onPano(parcheCenefaSoftLight(v))}
            />
            <p className="text-[0.68rem] text-muted-foreground">
              El soft light siempre lleva cenefa: la ovalada viene con el sistema; con «Cuadrada»
              se fabrica como el DARK (tapas fijas, no se pregunta).
            </p>
          </div>
        );
      }
      // La dúo (y el roller de cenefa ovalada) la llevan por SISTEMA: no se
      // elige. Se mira la categoría y NO `cenefaOvalada`, que es «chip Ovalada
      // O implícita» — con eso, una dúo con «Ovalada» ya puesta volvía a
      // mostrar los cuatro chips y se le podía sacar la cenefa.
      const cenefaFija = llevaCenefaOvaladaImplicita(ventana.categoria, reglas.tipos);
      // Las mismas opciones que la ficha y el dictado: una sola lista.
      const opcionesCenefaTipo = opcionesCenefa(ventana.categoria, pano.cenefa as string, reglas.tipos);
      return (
        <div className="space-y-3">
          {cenefaFija ? (
            <Derivado label="Tipo" valor="Ovalada" nota="fija por el tipo de cortina" />
          ) : (
            <RadioRow
              label="Tipo"
              value={pano.cenefa || ''}
              options={opcionesCenefaTipo}
              onChange={(v) => onPano(parcheCenefaTipo(v, { lineaB: props.lineaB }))}
            />
          )}
          {cenefaOvalada && (
            <>
              {props.lineaB ? (
                <p className="text-[0.68rem] text-muted-foreground">
                  Tira: <strong>SIN TIRA</strong> — las cenefas de categoría B van siempre sin tira.
                </p>
              ) : (
                <RadioRow
                  label="Tira"
                  value={pano.cenefaTira || ''}
                  options={OPCIONES_CENEFA_TIRA}
                  onChange={(v) => onPano({ cenefaTira: v })}
                />
              )}
              <RadioRow
                label="Color tapa"
                value={pano.colorTapa || ''}
                options={opcionesColorConGuardado(
                  coloresParaUso('tapaOvalada', reglas.colores),
                  pano.colorTapa as string,
                )}
                onChange={(v) => onPano({ colorTapa: v })}
              />
              <RadioRow
                label="Bracket"
                value={pano.bracketTipo || ''}
                options={OPCIONES_BRACKET_TIPO}
                onChange={(v) => onPano({ bracketTipo: v })}
              />
            </>
          )}
          {/* En oscuridad la cuadrada lleva tapas FIJAS por sistema: no se
              pregunta (misma guardia que el gate y la ficha). */}
          {esCenefaCuadrada(pano.cenefa as string) &&
            !cenefaCuadradaTapasFijas(ventana.categoria, pano.cenefa as string, reglas.tipos) && (
            <>
              <RadioRow
                label="Tapas"
                value={pano.cenefaTapa || ''}
                options={OPCIONES_CENEFA_TAPA}
                onChange={(v) => onPano({ cenefaTapa: v })}
              />
              <RadioRow
                label="Color tapa"
                value={pano.colorTapa || ''}
                options={opcionesColorConGuardado(
                  coloresParaUso('tapaCuadrada', reglas.colores),
                  pano.colorTapa as string,
                )}
                onChange={(v) => onPano({ colorTapa: v })}
              />
            </>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
