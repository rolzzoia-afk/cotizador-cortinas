// Cuerpo de cada paso del wizard de terreno. Cada bloque edita los MISMOS
// campos que la ficha clásica y despacha por el mismo `onPano`/`onVentana`
// (que en la página son `actualizarPano`/`actualizarVentana`, con todas sus
// cascadas), así que las dos vistas guardan exactamente lo mismo.
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioRow } from '@/components/cotizador/editorPano/controles';
import { ProductoSelectorFase2 } from '@/components/cotizador/ProductoSelectorFase2';
import {
  OPCIONES_BRACKET_TIPO,
  OPCIONES_CENEFA,
  OPCIONES_CENEFA_TAPA,
  OPCIONES_CENEFA_TIRA,
  OPCIONES_CORTES,
  OPCIONES_LADO_MOTOR,
  OPCIONES_MATERIAL_TIPO,
  OPCIONES_MOTOR_MODELO,
  OPCIONES_SUPERFICIE,
  OPCIONES_SUPLEMENTO,
  OPCIONES_TIPO_TELA,
  esCenefaCuadrada,
} from '@/modules/cotizador/fase2';
import { categoriasFase1ConTipos } from '@/modules/cotizador/categorias';
import {
  derivarLargoColor,
  etiquetaCadena,
  cadenasRoller,
  pesosSeleccionables,
  type CadenaInsumo,
} from '@/modules/cotizador/cadenas';
import { colorAccesorioCorto, tipoTelaDesdeProducto } from '@/modules/cotizador/fase0-sync';
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
  opcionesMecanismo: readonly string[];
  opcionesTuberia: readonly string[];
  notaMecanismo?: string;
  lineaB: boolean;
  onVentana: (patch: Partial<Ventana>) => void;
  onPano: (patch: Partial<Pano>) => void;
  onCategoria: (categoria: string) => void;
};

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
        </div>
      );

    case 'soportes':
      return (
        <div className="space-y-3">
          <RadioRow
            label="Color"
            value={colorAccesorioCorto(colorAccesoriosDePano(pano, ventana.color))}
            options={coloresAcc}
            onChange={(v) =>
              // Un solo control pinta las tres piezas, como en la ficha.
              onPano({ colorMecanismo: v, colorCadena: v, colorPeso: v })
            }
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
      const cargadorOpts =
        (pano.motorModelo || '').toUpperCase() === 'DOM38' ? CARGADOR_DOM38 : CARGADOR_DOM41;
      const cadenasDisponibles = cadenasRoller(props.cadenas, {}, reglas.cadenas);
      const pesosDisponibles = pesosSeleccionables(props.pesos);
      return (
        <div className="space-y-3">
          <RadioRow
            label="Acciona"
            value={conMotor ? 'MOTOR' : 'CADENA'}
            options={[
              { value: 'CADENA', label: 'Con cadena' },
              { value: 'MOTOR', label: 'Con motor' },
            ]}
            onChange={(v) => {
              if (v === 'MOTOR') {
                // Pasar a motor limpia la cadena: el kit ya no la lleva.
                onPano({
                  motorModelo: pano.motorModelo || (cenefaOvalada ? 'DOM38' : 'DOM41'),
                  codCadena: '',
                  largoCadena: '',
                  colorCadena: '',
                });
              } else {
                onPano({ motorModelo: '', motorTipo: '', ladoMotor: '' });
              }
            }}
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
                    onChange={(e) => {
                      const cod = e.target.value;
                      if (!cod) return onPano({ codCadena: '', largoCadena: '', colorCadena: '' });
                      const { largoCadena, colorCadena } = derivarLargoColor(
                        cod,
                        props.cadenas,
                        reglas.cadenas,
                      );
                      onPano({ codCadena: cod, largoCadena, colorCadena });
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
                if (esDual) {
                  onPano({
                    codInt: sel.codInt,
                    producto: sel.producto,
                    descripcion: sel.descripcion,
                    tipoTela: tipoTelaDesdeProducto(catalogo[sel.codInt]?.cod, sel.codInt),
                  });
                } else {
                  onVentana({
                    codInt: sel.codInt,
                    producto: sel.producto,
                    tipo: sel.tipo,
                    descripcion: sel.descripcion,
                  });
                  onPano({
                    tipoTela: tipoTelaDesdeProducto(catalogo[sel.codInt]?.cod, sel.codInt),
                  });
                }
              }}
            />
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
      const cenefaFija = cenefaOvalada && pano.cenefa !== 'Ovalada';
      return (
        <div className="space-y-3">
          {cenefaFija ? (
            <Derivado label="Tipo" valor="Ovalada" nota="fija por el tipo de cortina" />
          ) : (
            <RadioRow
              label="Tipo"
              value={pano.cenefa || ''}
              options={OPCIONES_CENEFA}
              onChange={(v) =>
                onPano({
                  cenefa: v,
                  cenefaTira: !props.lineaB && v === 'Ovalada' ? 'CON TIRA' : 'SIN TIRA',
                })
              }
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
          {esCenefaCuadrada(pano.cenefa as string) && (
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
