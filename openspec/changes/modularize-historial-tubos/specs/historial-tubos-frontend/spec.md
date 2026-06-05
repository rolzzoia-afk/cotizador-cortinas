# Spec: Frontend de Historial de Tubos

## ADDED Requirements

### Requirement: La página vive en `src/pages/HistorialTubos.tsx`

El archivo `src/pages/HistorialTubos.tsx` SHALL exportar una función nombrada `HistorialTubos` que es el componente React raíz de la ruta `/historial-tubos`.

#### Scenario: Import desde la app

- **GIVEN** `src/App.tsx` define la ruta `historial-tubos`
- **WHEN** la app lazy-importa `@/pages/HistorialTubos`
- **THEN** el export `{ HistorialTubos }` está disponible y se renderiza dentro del `Suspense` correspondiente.

### Requirement: El orquestador es delgado

El archivo `src/pages/HistorialTubos.tsx` MUST no exceder 100 líneas y SHALL solo manejar: imports, lectura de `useAuth().empresaId`, estado del tab activo, y el render de los 3 botones de tab + la vista seleccionada.

#### Scenario: Orquestador sin lógica de datos

- **GIVEN** un desarrollador abre `src/pages/HistorialTubos.tsx`
- **THEN** no encuentra queries a Supabase, ni declaraciones de tipos de dominio, ni constantes de configuración (`EV`, `FUENTE_CFG`, `PALETA`), ni funciones helper de formato.

### Requirement: Las 3 vistas viven en archivos propios

Cada una de las 3 vistas principales (Trazabilidad, Historial, Merma) MUST vivir en su archivo bajo `src/pages/historial-tubos/vistas/`:

- `vistas/VistaTrazabilidad.tsx` SHALL exportar `VistaTrazabilidad` por default.
- `vistas/VistaHistorial.tsx` SHALL exportar `VistaHistorial` por default.
- `vistas/VistaMerma.tsx` SHALL exportar `VistaMerma` por default.

Cada vista SHALL recibir `empresaId: string | null | undefined` como única prop y hace su propia consulta a Supabase internamente.

#### Scenario: Las 3 vistas son intercambiables y aisladas

- **GIVEN** el orquestador renderiza una de las 3 vistas según el tab activo
- **WHEN** el usuario cambia de tab
- **THEN** la vista anterior se desmonta y la nueva se monta, cargando sus propios datos desde cero (no se comparte state entre vistas).

### Requirement: Los tipos de dominio viven en `HistorialTubos.types.ts`

El archivo `src/pages/historial-tubos/HistorialTubos.types.ts` MUST exportar los tipos `Evento` y `EvCfg`. Cualquier vista o componente que necesite estos tipos SHALL importarlos de ahí.

#### Scenario: Tipo Evento centralizado

- **GIVEN** `VistaHistorial.tsx` necesita declarar el tipo de los registros de `eventos_tubos`
- **THEN** importa `type Evento` desde `@/pages/historial-tubos/HistorialTubos.types` y no lo redefine inline.

### Requirement: La configuración visual vive en `HistorialTubos.config.ts`

El archivo `src/pages/historial-tubos/HistorialTubos.config.ts` MUST exportar:

- `EV: Record<string, EvCfg>` — mapeo de tipo de evento a config visual (color, ícono, label, esRestauracion).
- `FUENTE_CFG: Record<string, { label: string }>` — mapeo de fuente a label visible.
- `PALETA: string[]` — paleta de colores para charts de la vista Merma.

#### Scenario: Una sola fuente de verdad para los colores y labels

- **GIVEN** `VistaHistorial`, `VistaMerma` y `EventoItem` necesitan los íconos/colores/labels de los eventos
- **THEN** los 3 importan `EV` y `FUENTE_CFG` desde `@/pages/historial-tubos/HistorialTubos.config` y no los redefinen.

### Requirement: Los helpers de formato viven en `utils/formato-fechas.ts`

El archivo `src/pages/historial-tubos/utils/formato-fechas.ts` MUST exportar `formatFechaHora(d: string | null): string` y `formatMes(d: string): string`. Ambas funciones SHALL devolver strings en formato `es-CL`.

#### Scenario: Formato consistente entre vistas

- **GIVEN** `VistaHistorial` muestra fechas en columna "Cuándo" y `VistaMerma` muestra meses en eje X del chart
- **WHEN** ambas formatean la misma fecha
- **THEN** ambas usan los helpers de `utils/formato-fechas` y muestran formato `es-CL` consistente.

### Requirement: Los componentes hoja viven en `components/`

Los 6 componentes de UI auxiliares MUST vivir cada uno en su archivo bajo `src/pages/historial-tubos/components/`:

- `components/TabButton.tsx` — botón de tab activo/inactivo.
- `components/FichaCard.tsx` — tarjeta de ficha de tubo (cabecera + secciones).
- `components/FichaSeccion.tsx` — bloque de sección dentro de `FichaCard`.
- `components/EventoItem.tsx` — fila de un evento en la lista del historial.
- `components/StatBox.tsx` — caja de KPI numérico para el dashboard de Merma.
- `components/EmptyState.tsx` — placeholder cuando no hay datos.

Cada componente SHALL exportar su función por default.

#### Scenario: Cada componente es importable directamente

- **GIVEN** una de las 3 vistas necesita un componente
- **THEN** lo importa por su path explícito: `import FichaCard from '../components/FichaCard'`.

### Requirement: Ningún archivo excede 400 líneas

Después del refactor, ningún archivo bajo `src/pages/historial-tubos/` ni el propio `src/pages/HistorialTubos.tsx` MUST exceder 400 líneas (contando líneas en blanco y comentarios).

#### Scenario: Auditoría de tamaños

- **WHEN** se ejecuta `find src/pages/historial-tubos src/pages/HistorialTubos.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`
- **THEN** ningún archivo individual reporta más de 400 líneas.
