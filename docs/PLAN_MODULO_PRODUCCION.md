# Plan — Módulo Producción visual (submódulos por área + bodega + costo total)

> **Estado: APROBADO EN DISEÑO, SIN EMPEZAR.** Escrito el 2026-08-26 a partir
> de la exploración completa del repo. Nada de esto está implementado todavía.
> Cuando se retome, este archivo es la fuente de verdad: las decisiones del
> dueño y los hallazgos de la exploración ya están cerrados, no hay que
> re-investigar ni volver a preguntar.

## Contexto

El taller necesita ver EN PANTALLA lo que hoy solo existe como Excel/PDF
descargable, siguiendo el flujo real: **Estructura ∥ Paños (paralelos) →
Dimensionado (cuando Paños termina) → Armado (cuando Estructura Y Dimensionado
terminan) → Prueba**. Cada submódulo lleva un botón de emergencia que deja un
aviso al encargado de producción (perfil futuro). Además (maquetas del
2026-08-26): un submódulo **Inventario (bodega)** con picking visual por área
(Armado / Estructura / Instalación: OK por insumo, ver ubicación en rack,
bolsa lista + rack asignado, imprimir, inicio/fin/total) y una pantalla
**Costo total** por OT que SOLO ven los administradores (resumen de consumo
telas/aluminio con fallas, costos, cotizado, ganancia y margen %).

**Decisiones del dueño (2026-08-26):**
- El Excel del optimizador de estructura es SIEMPRE de una sola OT → buscador
  OT → su plan.
- Entrega **por etapas** (PRs independientes, cada uno con su «armalo»).
- Grupo «INSUMOS» (tapas/topes/tornillos/zunchos) va DENTRO de la columna
  Armado (como en la maqueta).
- Costo de telas: campo **Costo** nuevo en el catálogo de telas; el importador
  Excel lo lee (hoy esa columna se descarta).
- FALLAS / MTS FALLA: a mano en la pantalla Costo total (digitalizar el
  registro en producción queda para más adelante).

**Lo que ya existe y se reutiliza (verificado):**
- Hoja «Plan de Corte» (13 col): `src/modules/planes-corte/exportar-excel.ts`
  (puro salvo XLSX; SIN tests; únicos consumidores `HistorialCorte.tsx:505,547`).
  Colores del Excel hoy NO se pintan (xlsx community); en pantalla SÍ.
- Corte de paños: `construirHojaCorte`/`partirHojaCorte`/`pieceId`/`optimizador`
  (metros por COD_INT netos de colmena) en
  `src/modules/cotizador/pdfCorteOptimizacion.ts`; receta de inputs lista en
  `OptimizadorOTSection.tsx:300-347`.
- Dimensionado/cálculo general: `construirCalculoGeneral` → `{filas,
  identidad, bloques}` (render HTML directo) + `aplicarVariante(…,
  VARIANTE_DIMENSIONADO)` en `src/modules/cotizador/pdfCalculoGeneral.ts`.
- Grupos de bodega: `GrupoInsumo = 'INSUMOS'|'PRODUCCION'|'ESTRUCTURA'|
  'INSTALACION'` + `consolidarInsumos(...)` en
  `src/modules/cotizador/pdfInventario.ts:114,184-192,214-510` (PRODUCCION ≈
  Armado; ESTRUCTURA solo se llena con vertical/beeblack; el grupo vive solo
  en memoria — no se persiste).
- Ubicaciones: `insumos.ubicacion`, tabla `ubicaciones_rack`
  (rack/fila/columna/codigo_insumo/almacen), layout físico en
  `src/modules/inventario/rackConfig.ts`, mapa en
  `src/pages/inventario/tabs/RackTab.tsx`; helpers `getUbicacionBOM`,
  `buscarInsumoMatchBOM`, `rackToQRContent`, `getColmenaPorCodTubo` en
  `src/modules/bodega/bomUtils.ts:76-243`. La app nunca ESCRIBE
  `ubicaciones_rack` (solo select).
- Impresión bodega: patrón `QRInsumoDialog.tsx` (HTML + `@media print` +
  `window.print()`, `qrcode.react`).
- Costos: `insumos.costo`/`costo_iva` (¡por PAQUETE! dividir por
  `can_x_paquete`, ver `InsumosPreciosSection.tsx:206-219`) y
  `reglasPrecios.insumos[cod].valorMaximo` (= costo unitario c/IVA, curado).
  Normalización de códigos `E 02`↔`E02`: `clave()` de
  `InsumosPreciosSection.tsx:65`. Telas SIN costo en ninguna parte (el
  importador ya VE la columna «Costo» del Excel y la bota:
  `importarCatalogo.test.ts:19,27,71`).
- Consumos por OT: aluminio real en `tubos_historial` (Σ `medida_cm` por
  `cod`, `evento='corte'`, `ot`=número; patrón de agregación en
  `VistaMerma.tsx:48-90`); telas por `construirHojaCorte().optimizador`;
  colmena por `datos_generales.corteGeneralColmena`; insumos por
  `orden_materiales` (ot_id uuid) / `movimientos_insumos` (ot texto).
- Totales: `ots.total` = total transferencia c/IVA; neto = `total/(1+iva)`
  con `parametros.iva` (`useParametrosCotizador`). Defaults de mano de
  obra/traslado en `ParametrosCotizador` y `SistemaPrecio`.
- Sub-etapas: `ots.datos_generales.subEtapa`, `SUB_ETAPAS_PROD`
  (`src/modules/ots/constants.ts`), `SUB_ETAPA_META` con `.orden`
  (`src/modules/cotizador/fase4.ts`); `ots.numero_ot` es columna real.
- Realtime: patrón `src/modules/ots/hooks.ts:69` / `leads/hooks.ts:42`.
  SQL plantilla: `sql/20260512_crm_fase1_leads.sql` (+ bloque realtime de
  `sql/20260803_realtime_colmena_tubos.sql`). **`empresa_id uuid NOT NULL`
  SIN foreign key** (convención del repo).
- NO existe sistema de notificaciones ni registro de tiempos de tarea →
  tablas nuevas. `alertas_stock` está muerta: NO revivirla.

**Decisiones de diseño:**
1. Checks NO van en `datos_generales` (upsert de OT completa = last-write-wins
   con operarios concurrentes) → tabla `produccion_checks`, una fila por check.
2. Clave de fila del plan: `ref = plan_id`, `clave = 'r{idx}'` (índice en
   `plan.resultados[]`; el reorden MESA no altera índices). Se chequea la fila
   CORTAR; la de sobrante acompaña sin check. % = marcadas / filas de corte.
   Plan corregido = nuevo plan_id → checks huérfanos (aceptado; la UI avisa
   «el plan fue corregido, el avance se reinició»).
3. Estado «área lista» y datos puntuales del submódulo bodega en la MISMA
   tabla con claves sentinel (`'__area__'`, `'__inicio__|GRUPO'`,
   `'__rack__|GRUPO'` con el valor en `nota`) — un hook, un canal, una RLS.
4. `ref text NOT NULL DEFAULT ''`: PostgREST solo upsertea contra UNIQUE de
   columnas reales.
5. Compuertas puras: `calcularSubEtapa(areasListas)` → objetivo;
   `debeAvanzar(actual, objetivo)` solo si sube de orden → nunca retrocede;
   se dispara SOLO al marcar un área. El select manual del Panel sigue
   mandando como override.
6. Tipos de BD desactualizados: `.from('tabla' as any)` + eslint-disable
   localizado (patrón leads).
7. Pestaña «Costo total» solo se RENDERIZA para `esRolAdmin` (la ruta
   /produccion es de taller; el gate es por pestaña) y los costos solo se
   consultan dentro de ella.
8. Bodega usa `consolidarInsumos` (el MISMO dato del PDF de inventario), no
   `calcularBOM` — son dos motores paralelos y el del PDF es el que trae el
   grupo por área. Mapeo de columnas: PRODUCCION+INSUMOS → Armado,
   ESTRUCTURA → Estructura, INSTALACION → Instalación.

**Reglas de siempre:** SQL en `sql/` que corre el USUARIO; el PR con SQL lleva
link directo al .sql; nada de `docs/referencias|informes` al repo; commit solo
con «armalo» (rama → CI verde → squash-merge); español neutro; scan de
secretos en el diff staged.

---

## PR 1 — Base + SQL + emergencia + Estructura completo

### SQL — `sql/20260826_produccion_checks_avisos.sql` (NUEVO)

```sql
CREATE TABLE IF NOT EXISTS produccion_checks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL,
  ot            text NOT NULL,                -- numero_ot
  area          text NOT NULL CHECK (area IN
    ('estructura','panos','dimensionado','armado','prueba','bodega')),
  ref           text NOT NULL DEFAULT '',     -- ej. plan_id; '' si no aplica
  clave         text NOT NULL,                -- 'r{idx}' | pieceId | 'GRUPO|COD' | sentinels
  hecho         boolean NOT NULL DEFAULT true,
  nota          text,                         -- rack de bolsa, nota de problema…
  hecho_por     text,
  hecho_por_id  uuid,
  hecho_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT produccion_checks_unico UNIQUE (empresa_id, area, ot, ref, clave)
);
CREATE INDEX ... idx_prod_checks_ot ON produccion_checks(empresa_id, ot, area);

CREATE TABLE IF NOT EXISTS avisos_produccion (
  id, empresa_id uuid NOT NULL, ot text NOT NULL DEFAULT '',
  area text CHECK (... áreas + 'bodega' + 'general'), mensaje text NOT NULL,
  creado_por text, creado_por_id uuid, creado_en timestamptz DEFAULT now(),
  atendido boolean NOT NULL DEFAULT false, atendido_por text, atendido_en timestamptz
);
CREATE INDEX ... (empresa_id, atendido, creado_en DESC);
```
+ RLS (4 policies por tabla, bloque literal de la plantilla leads) + bloque
`DO $$` idempotente para `publication supabase_realtime` + `NOTIFY pgrst` +
smoke tests comentados. Sin FKs.

### Refactor — `src/modules/planes-corte/construirFilasPlan.ts` (NUEVO)

Se MUEVEN (no duplican) desde `exportar-excel.ts`: `ResultadoCorte`,
`OrdenLike`, `ResultadoItem`, `PlanParaExportar`, `formatearFecha`, `getR`,
`getOrd`. **Sin `import * as XLSX`** (no arrastrar xlsx al chunk). Nuevo:

```ts
export type TipoFilaPlan = 'corte' | 'corte-mesa' | 'sobrante' | 'merma' | 'reserva-mesa';
export type FilaPlan = {
  clave: string;   // 'r{idx}' | 'r{idx}:s'
  idx: number; tipo: TipoFilaPlan; conTira: boolean;
  celdas: { ot; ubicacion; accion; colmena; codigo; color; perforacion;
            medidaCm; origenCm; lote; paquete; serial; fechaSerial };
};
export function construirFilasPlan(plan: PlanParaExportar): FilaPlan[];
export function extraerOTsDePlan(plan: PlanParaExportar): string[];
```
Puerto 1:1 de exportar-excel.ts:96-261 (CORTAR con TUBO NUEVO/REEMPLAZO/CON
TIRA solo CENEFA OVALADA; sobrante RESERVAR EN MESA / DESECHAR MERMA con
defensa ≤10 cm / GUARDAR SOBRANTE; reorden MESA sobre `FilaPlan[]`).
`parsers.ts` y `PlanTabla.tsx` NO se tocan. `exportar-excel.ts` pasa a usar
`construirFilasPlan` (firma pública intacta, estilos por `tipo`/`conTira`).

Tests `construirFilasPlan.test.ts`: corte+sobrante; merma ≤10; reorden MESA
(productor antes, claves conservan idx); TUBO NUEVO/reemplazo; CON TIRA;
`extraerOTsDePlan` con orden objeto y string.

### Módulo `src/modules/produccion/` (NUEVO)

- `types.ts`: `AreaProduccion` (incluye 'bodega'), `CheckProduccion`,
  `AvisoProduccion`.
- `constants.ts`: `CLAVE_AREA = '__area__'`, `AREAS_PRODUCCION`
  (key/label/subEtapa).
- `avance.ts` (puro): `calcularAvance(claves, hechas)`;
  `calcularSubEtapa(listas)`: prueba✓→'Lista' | armado✓→'Prueba' |
  estructura✓∧dimensionado✓→'Armado' | panos✓→'Dimensionado' |
  →'Estructura'; `debeAvanzar(actual, objetivo)` por `SUB_ETAPA_META[].orden`.
  + `avance.test.ts` (tabla de compuertas + no-retroceso + calcularAvance).
- `hooks.ts` (`as any` + eslint-disable):
  - `usePlanDeOT()`: `planes_corte` (id,fecha,resultados,ordenes)
    `.is('tipo',null).order('fecha',desc).limit(50)` → primer plan cuyo
    `extraerOTsDePlan` incluye el número → `filas`.
  - `useChecks(area, ot, ref='')`: `hechas: Set`, `quien: Map`, `areaLista`,
    `marcar(clave, hecho, nota?)` (upsert onConflict
    `'empresa_id,area,ot,ref,clave'`), `marcarAreaLista`. Realtime con filtro
    fino en el handler. `hecho_por = useAuth().perfil.nombre`.
  - `useAvanceSubEtapa(numeroOT)`: sentinels de las áreas + `sincronizar()`:
    fetch por `.eq('numero_ot',n).eq('empresa_id',e)` → `rowToOT` → si
    `debeAvanzar` → patch subEtapa+fechaModificacion → `otToRow` → upsert
    (espejo de `useOT().guardar`).
- `avisos.ts`: `useAvisos()` → `avisos`, `pendientes`, `crear`, `atender`.

### Páginas

- `src/pages/Produccion.tsx` — named export; patrón `HistorialTubos.tsx`:
  tabs Estructura / Paños / Dimensionado / Armado / Prueba / Inventario +
  **Costo total solo si `esRolAdmin`**.
- `src/pages/produccion/components/`: `TabButton.tsx` (copia),
  `BotonEmergencia.tsx` ({ot?, area} → Dialog + textarea → `crear` → toast),
  `BuscadorOT.tsx` (número OT → cliente + badge subEtapa; «No se encontró un
  plan de corte para la OT …»), `HojaPlanCorte.tsx` (13 columnas del Excel +
  check; colores por `tipo`: merma→rojo, reserva-mesa→naranjo,
  corte-mesa→azul, conTira→amarillo; barra de %; tooltip «hecho por X»).
- `vistas/VistaEstructura.tsx` — Buscador + HojaPlanCorte +
  `useChecks('estructura', ot, planId)` + «Estructura lista» (`confirmar()`
  si pct < 100) → sentinel + `sincronizar()`.
- `VistaPanos/VistaDimensionado/VistaArmado/VistaPrueba/VistaInventario/
  VistaCosto.tsx` — stubs con BotonEmergencia funcional (VistaCosto solo
  admin).

### Navegación

- `src/App.tsx`: lazy + `<Route path="produccion">` en el bloque Shell.
- `src/lib/roles.ts`: `{ patron: /^\/produccion/, roles: ['produccion',
  'dimensionado','telas','operario','pruebas','bodeguero'] }` (cierra además
  el hueco «sin regla → cualquiera entra») + caso en `roles.test.ts`.
- `TopBar.tsx`: link «Producción». `Landing.tsx`: tile nueva «Taller» →
  `/produccion` (NO tocar la tile «Producción» → `/optimizador`).
- `docs/MANUAL_USUARIO.md`: sección del módulo.

## PR 2 — Corte de paños

- `VistaPanos.tsx` + `components/HojaCortePanos.tsx`: HTML fiel del PDF de
  corte (`construirHojaCorte`/`partirHojaCorte`, secciones principal y
  vertical, `totalesPorTipoDeTela`). Inputs igual que el call-site de
  `generarPdfHojaCorte` en `CotizadorFase4.tsx:397` (extraer helper con test
  si es largo).
- Checks por pieza: `clave = pieceId(...)`, `area='panos'`, ref=''.
- «Paños listos» → sentinel + `sincronizar()` ⇒ compuerta a Dimensionado.

## PR 3 — Dimensionado + Armado

- `components/HojaCalculo.tsx` compartida: tabla HTML de
  `construirCalculoGeneral` (identidad + bloques por sistema con su color);
  Dimensionado con `aplicarVariante(…, VARIANTE_DIMENSIONADO)` +
  `altoMesaCorteDuo` + `juntoPorPieza` (como `CotizadorFase4.tsx:303-316`).
- Dimensionado además: optimizador de telas visual en modo lectura (extraer
  cards/canvas de `PlanCorteSection.tsx` o reusar `OptimizadorOTSection.tsx`).
- `VistaArmado.tsx`: HojaCalculo completa + banner compuerta (Estructura ✓ /
  Dimensionado ✓); botones «Dimensionado listo» / «Armado listo».

## PR 4 — Prueba + bandeja de avisos

- `VistaPrueba.tsx`: checklist por cortina (`ot.storeVentanas`,
  `clave = ventana.id`), ok / problema-con-nota (nota → check + aviso).
  «OT lista»: réplica de `marcarComoLista` (`CotizadorFase4.tsx`).
- `components/BandejaAvisos.tsx` + sección «Avisos» con badge de pendientes y
  `atender(id)`; visible a admin y rol produccion.

## PR 5 — Inventario (bodega): picking visual por área

- `src/modules/cotizador/pdfInventario.ts`: exportar la consolidación para
  reuso (`construirInventario` ya es exportable; verificar que el render de
  pantalla pueda consumir `data.insumos` con su `grupo` sin tocar el PDF).
- `src/modules/produccion/bodega.ts` (puro + test): mapeo de columnas
  (PRODUCCION+INSUMOS→'ARMADO', ESTRUCTURA, INSTALACION), sub-secciones por
  tipo de código (MEC→Mecanismo, CAD→Cadenas, DOM→Motor, resto→Insumos),
  clave de check `'{grupo}|{codigo||descripcion}'`, estado de columna
  (EMPEZAR / EN PROCESO / COMPLETADO) y duración desde sentinels.
- `VistaInventario.tsx` + `components/ColumnaBodega.tsx`: 3 columnas como la
  maqueta; fila = [COD] descripción · cantidad · botón **OK** (verde al
  marcar, `useChecks('bodega', ot)`) · botón **Ver mapa**.
- `components/UbicacionDialog.tsx`: ubicación del insumo vía
  `getUbicacionBOM`/`buscarInsumoMatchBOM` (+ colmena para tubería) y la
  celda destacada en la grilla `rackConfig` (patrón RackTab, solo lectura).
- Bolsa: por columna, selector de rack (lista de `rackConfig`) persistido en
  sentinel `'__rack__|{grupo}'` (nota = rack) + botón imprimir etiqueta
  (patrón `QRInsumoDialog`: QR `BOLSA:{ot}|{grupo}` + texto OT/área/rack).
- Tiempos: primer OK de la columna escribe sentinel `'__inicio__|{grupo}'`;
  «Finalizar» (habilitado con todo OK) escribe `'__fin__|{grupo}'` y muestra
  Inicio / Fin / Total min. Estado de columna sale de esos sentinels.
- Sin descuento de stock ni firma: esta pantalla es PREPARACIÓN; el despacho
  con firma/stock sigue siendo el flujo Bodeguero actual (se anota en el
  manual para que no se confundan).

## PR 6 — Costo total (solo administradores)

- Catálogo: `Producto.costo?: number` (costo por metro, c/IVA) en
  `src/modules/cotizador/types.ts` + editor en `ProductosCatalogoSection` +
  `importarCatalogo.ts` gana campo `'costo'` (ALIAS «costo»; entra a
  `CampoCatalogo`, al diff y a la plantilla descargable).
- `src/modules/produccion/costoOT.ts` (puro + tests):
  - Resumen TELAS: filas por COD_INT — MTS de
    `construirHojaCorte().optimizador` (receta `OptimizadorOTSection.tsx:
    300-347`), COLMENA (conteo/medidas desde `corteGeneralColmena`), FALLAS y
    MTS FALLA manuales, TOTAL = MTS + MTS FALLA.
  - Resumen ALUMINIO: `tubos_historial` Σ `medida_cm`/100 por `cod`
    (`evento='corte'`, `ot`), merma con `evento='merma'`.
  - Costos: telas = Σ mts × `Producto.costo` (aviso por tela sin costo);
    aluminio = Σ m × `valorMaximo` del código (normalización `E 02`↔`E02`);
    insumos = `orden_materiales` × costo unitario (`insumos.costo_iva /
    max(1, can_x_paquete)`, fallback `valorMaximo`; se indica la fuente);
    mano de obra / auto / TAG manuales con defaults de parámetros.
  - Indicadores: neto = `ots.total/(1+iva)`; ganancia = neto − costo total;
    pérdida = costo de fallas (mts falla × costo tela); ganancia real =
    ganancia − pérdida; margen % = ganancia real / neto, verde ≥20 % (los
    umbrales/fórmulas quedan en constantes visibles para ajustar).
- Persistencia de lo manual: `datosGenerales.costosOT?: { manoObra, auto,
  tag, otros?, fallasTelas: Array<{cod, fallas, mts}>, nota? }` (tipo en
  `src/modules/ots/types.ts`; lo edita solo esta pantalla).
- `VistaCosto.tsx`: solo se monta si `esRolAdmin`; layout de la maqueta
  (Resumen OT / Costo OT / barra Información OT con margen grande).

## Riesgos

1. Checks huérfanos tras corrección de plan → aceptado; aviso en UI.
2. Concurrencia: checks en filas propias; los únicos writes de OT completa
   son `sincronizar()` (solo si `debeAvanzar`) y el guardado de `costosOT`
   (pantalla solo admin) — mismo riesgo que ya asume Fase 4.
3. `database.ts` viejo → `as any`; `npm run types:gen` opcional tras el SQL.
4. Realtime mudo si falta publicación → el SQL la agrega idempotente.
5. Regresión del Excel del plan → tests de `construirFilasPlan` + descarga
   manual en `/historial-corte` antes de mergear.
6. Dos motores de BOM (`calcularBOM` vs `consolidarInsumos`): bodega usa el
   segundo (idéntico al PDF); NO se intenta unificarlos en esta épica.
7. Costo por paquete: dividir SIEMPRE `costo_iva` por `can_x_paquete`;
   mostrar la fuente del costo por línea para poder auditar.
8. Bundle: las vistas importan `construirFilasPlan.ts`, nunca
   `exportar-excel.ts`; jsPDF/xlsx no entran al chunk de Producción.
9. Telas sin costo cargado → la pantalla muestra el hueco y suma $0 con
   aviso, nunca inventa.

## Verificación (por PR)

1. `npx tsc --noEmit` + `npx vitest run` + `npm run build` (chunk de
   Producción sin xlsx/jspdf).
2. Usuario aplica el .sql en Supabase (smoke tests comentados al final).
3. Navegador: rol produccion → `/produccion` → buscar OT con plan → hoja con
   colores; checks en dos navegadores (realtime, sin pisadas); «Estructura
   lista» → subEtapa avanza y nunca retrocede; botón de emergencia inserta
   aviso; bodega: marcar OKs, ver mapa, asignar rack, imprimir etiqueta,
   finalizar con tiempos; Costo total visible SOLO como admin y los números
   cuadran con una OT real conocida; re-descargar el Excel del plan desde
   `/historial-corte` y comparar con uno previo.
