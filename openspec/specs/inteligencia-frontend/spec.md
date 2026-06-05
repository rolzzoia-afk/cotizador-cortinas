# inteligencia-frontend Specification

## Purpose
TBD - created by archiving change modularize-inteligencia. Update Purpose after archive.
## Requirements
### Requirement: La página vive en `src/pages/Inteligencia.tsx`

El archivo `src/pages/Inteligencia.tsx` SHALL exportar una función nombrada `Inteligencia` que es el componente React raíz de la ruta `/inteligencia`.

#### Scenario: Import desde la app

- **GIVEN** `src/App.tsx` define la ruta `inteligencia`
- **WHEN** la app lazy-importa `@/pages/Inteligencia`
- **THEN** el export `{ Inteligencia }` está disponible y se renderiza dentro del `Suspense` correspondiente.

### Requirement: El orquestador es delgado

El archivo `src/pages/Inteligencia.tsx` MUST no exceder 200 líneas y SHALL solo manejar: imports, llamada al hook `useInteligenciaData()`, memos derivados (filtrados y agregaciones que alimentan a varias cards), estado del filtro de categoría, estado del diálogo de diagnóstico, y el render del header + summary + grid de cards.

#### Scenario: Orquestador sin queries directos

- **GIVEN** un desarrollador abre `src/pages/Inteligencia.tsx`
- **THEN** no encuentra llamadas directas a `supabase.from(...)`, ni declaraciones inline de los tipos de dominio (`OT`, `Insumo`, `Mov`, `Rack`, `ErrorCorte`), ni constantes (`ESTADOS_ACTIVOS`, `COLORES_ERROR`, `CHIPS`), ni funciones helper de formato (`fmt`, `diasDesde`, `fmtFecha`).

### Requirement: La carga de datos vive en `hooks/useInteligenciaData.ts`

El archivo `src/pages/inteligencia/hooks/useInteligenciaData.ts` MUST exportar un hook `useInteligenciaData()` que:

- Hace 6 queries Supabase en paralelo (`ots`, `insumos`, `movimientos_insumos`, `ubicaciones_rack`, `movimientos_insumos` filtrado por hoy, `errores_corte`).
- Devuelve `{ ots, insumos, movs, movsHoy, racks, errores, loading, refreshing, lastUpdate, refresh }`.
- Auto-refresca cada 5 minutos mientras el componente esté montado.
- Re-ejecuta la carga cuando cambia `empresaId` (leído internamente de `useAuth()`).

#### Scenario: Una sola fuente de datos

- **GIVEN** el orquestador necesita las 6 colecciones para alimentar las cards
- **WHEN** llama `useInteligenciaData()`
- **THEN** recibe los 6 datasets ya cargados y un `refresh()` para forzar recarga manual.

### Requirement: Las 9 cards viven cada una en su archivo

Las 9 cards del dashboard MUST vivir cada una en su archivo bajo `src/pages/inteligencia/cards/`:

- `cards/KPICard.tsx`
- `cards/CrossAlertsCard.tsx`
- `cards/OTRiskCard.tsx`
- `cards/ConsumoCard.tsx`
- `cards/ErroresCorteCard.tsx`
- `cards/RestockCard.tsx`
- `cards/ActivityCard.tsx`
- `cards/InsightsCard.tsx`
- `cards/StockGeneralCard.tsx`

Cada card SHALL exportar su función por default y recibir como props únicamente los slices de datos que necesita (no leer state ni queries propios).

#### Scenario: Cards son componentes puros

- **GIVEN** un desarrollador abre cualquier card
- **THEN** la card no llama a `supabase`, no usa `useAuth`, y no maneja recarga de datos — todo le llega por props desde el orquestador.

### Requirement: Los tipos de dominio viven en `Inteligencia.types.ts`

El archivo `src/pages/inteligencia/Inteligencia.types.ts` MUST exportar los tipos `OT`, `Insumo`, `Mov`, `Rack`, `ErrorCorte`. Cualquier card, hook o util que necesite estos tipos SHALL importarlos de ahí.

#### Scenario: Tipos centralizados

- **GIVEN** una card necesita declarar el shape de `Insumo`
- **THEN** importa `type Insumo` desde `@/pages/inteligencia/Inteligencia.types` y no lo redefine inline.

### Requirement: La configuración visual y de estado vive en `Inteligencia.config.ts`

El archivo `src/pages/inteligencia/Inteligencia.config.ts` MUST exportar:

- `ESTADOS_ACTIVOS: string[]` — lista de estados que cuentan como "OT activa".
- `ESTADOS_PRODUCCION: string[]` — lista de estados que cuentan como "en producción".
- `COLORES_ERROR: Record<string, string>` — mapeo de motivo de error a color para el chart.
- `CHIPS: Array<{ label: string; prompt: string }>` — sugerencias rápidas para el diálogo de diagnóstico.

#### Scenario: Una sola fuente de verdad para las constantes

- **GIVEN** el orquestador y `ErroresCorteCard` necesitan filtrar/colorear estados
- **THEN** ambos importan las constantes desde `@/pages/inteligencia/Inteligencia.config` y no las redefinen.

### Requirement: Los helpers de formato viven en `utils/formato.ts`

El archivo `src/pages/inteligencia/utils/formato.ts` MUST exportar `fmt`, `diasDesde`, `diasHasta`, `fmtFecha`, `fmtFechaHora`, `dgStr`. Son funciones puras sin estado.

#### Scenario: Helpers reutilizables

- **GIVEN** varias cards muestran fechas en formato corto
- **THEN** todas importan `fmtFecha` y `fmtFechaHora` de `utils/formato` y muestran el formato `es-CL` consistente.

### Requirement: `generarTextoDiag` vive separada del diálogo

El archivo `src/pages/inteligencia/utils/generar-texto-diag.ts` MUST exportar `generarTextoDiag(ots, insumos, movs, racks): string` — una función pura que produce el texto del diagnóstico. El archivo `src/pages/inteligencia/components/DiagDialog.tsx` MUST contener únicamente la UI del modal y consumir `generarTextoDiag` para producir el texto.

#### Scenario: Lógica de texto reutilizable

- **GIVEN** el diálogo de diagnóstico necesita generar el texto
- **WHEN** se monta
- **THEN** llama a `generarTextoDiag(ots, insumos, movs, racks)` para producir el reporte, sin que la función dependa de DOM o de React.

### Requirement: Componentes UI compartidos viven en `components/`

Los componentes de UI auxiliares compartidos por varias cards MUST vivir bajo `src/pages/inteligencia/components/`:

- `components/GlassCard.tsx` — wrapper de card con efecto vidrio.
- `components/EmptyState.tsx` — placeholder cuando una card no tiene datos.
- `components/Spinner.tsx` — indicador de carga inicial.
- `components/DiagDialog.tsx` — diálogo del diagnóstico IA.

Cada componente SHALL exportar su función por default.

#### Scenario: GlassCard reusable

- **GIVEN** cada una de las 9 cards necesita el mismo wrapper visual
- **THEN** todas importan `GlassCard` desde `@/pages/inteligencia/components/GlassCard` y lo usan como contenedor.

### Requirement: Ningún archivo excede 400 líneas

Después del refactor, ningún archivo bajo `src/pages/inteligencia/` ni el propio `src/pages/Inteligencia.tsx` MUST exceder 400 líneas (contando líneas en blanco y comentarios).

#### Scenario: Auditoría de tamaños

- **WHEN** se ejecuta `find src/pages/inteligencia src/pages/Inteligencia.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`
- **THEN** ningún archivo individual reporta más de 400 líneas.

