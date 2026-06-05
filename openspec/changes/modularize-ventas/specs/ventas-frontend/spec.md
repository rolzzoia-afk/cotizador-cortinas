# Spec: Frontend del Panel KPI Ventas

## ADDED Requirements

### Requirement: La página vive en `src/pages/Ventas.tsx`

El archivo `src/pages/Ventas.tsx` SHALL exportar una función nombrada `Ventas` que es el componente raíz de la ruta `/ventas`.

#### Scenario: Import desde la app

- **GIVEN** `src/App.tsx` define la ruta `ventas`
- **WHEN** la app lazy-importa `@/pages/Ventas`
- **THEN** el export `{ Ventas }` está disponible.

### Requirement: El orquestador es delgado

El archivo `src/pages/Ventas.tsx` MUST no exceder 300 líneas y SHALL manejar: imports, lectura de `useAuth().empresaId`, state de UI (fecha, periodo, config, registros, historial), las 3 queries Supabase (`kpi_config`, `kpi_registros`, historial), memos derivados (totales, charts, terrenoData, cierre), y el render del header + date bar + 6 secciones + diálogo.

#### Scenario: Sin lógica interna duplicada

- **GIVEN** un desarrollador abre `src/pages/Ventas.tsx`
- **THEN** no encuentra declaraciones inline de tipos, constantes, helpers ni de componentes UI o secciones.

### Requirement: Las 6 secciones viven cada una en su archivo

Las 6 secciones del dashboard MUST vivir bajo `src/pages/ventas/secciones/`:

- `secciones/CanalesSection.tsx`
- `secciones/LlamadasSection.tsx`
- `secciones/MetaVisitasSection.tsx`
- `secciones/CierreSection.tsx`
- `secciones/TerrenoSection.tsx`
- `secciones/HistorialSection.tsx`

Cada sección SHALL exportar su función por default y recibir como props los slices de state + setters que necesita (no leer state ni queries propios).

#### Scenario: Secciones son componentes puros

- **GIVEN** un desarrollador abre una sección
- **THEN** la sección no llama a `supabase`, no usa `useAuth`, y no maneja la carga de datos.

### Requirement: Los tipos viven en `Ventas.types.ts`

El archivo `src/pages/ventas/Ventas.types.ts` MUST exportar los tipos `KpiConfig`, `Periodo`, `Registro`. Cualquier sección o componente que necesite estos tipos SHALL importarlos de ahí.

#### Scenario: Tipos centralizados

- **GIVEN** una sección necesita el tipo `KpiConfig`
- **THEN** importa `type KpiConfig` desde `@/pages/ventas/Ventas.types` y no lo redefine inline.

### Requirement: Las constantes viven en `Ventas.config.ts`

El archivo `src/pages/ventas/Ventas.config.ts` MUST exportar `DEFAULT_CONFIG: KpiConfig` y `CANAL_COLORS: string[]`. Cualquier sección que necesite estos valores SHALL importarlos.

#### Scenario: Una sola fuente para defaults y paleta

- **GIVEN** `CanalesSection` y `LlamadasSection` necesitan la paleta de colores
- **THEN** ambas importan `CANAL_COLORS` desde `@/pages/ventas/Ventas.config`.

### Requirement: Los helpers viven en `utils/helpers.ts`

El archivo `src/pages/ventas/utils/helpers.ts` MUST exportar `hoyISO()`, `slugify(str)`, `iniciales(nombre)`, `colorPct(pct, meta)`. Son funciones puras sin estado.

#### Scenario: Helpers reutilizables

- **GIVEN** varias secciones derivan claves de configuración con `slugify`
- **THEN** todas importan `slugify` de `utils/helpers` en lugar de redefinirlo.

### Requirement: Los componentes UI compartidos viven en `components/`

Los componentes auxiliares compartidos por varias secciones MUST vivir bajo `src/pages/ventas/components/`:

- `components/SectionHeader.tsx` — header con ícono + título + sub + slot derecho.
- `components/Gauge.tsx` — gauge SVG semicircular para el % de cierre.
- `components/NumInput.tsx` — input numérico sin spinners.
- `components/ChipList.tsx` — lista de chips removibles.
- `components/ConfigDialog.tsx` — diálogo modal de configuración.

Cada componente SHALL exportar su función por default.

#### Scenario: SectionHeader reusable

- **GIVEN** las 6 secciones necesitan el mismo header con ícono coloreado
- **THEN** todas importan `SectionHeader` desde `@/pages/ventas/components/SectionHeader`.

### Requirement: Ningún archivo excede 400 líneas

Después del refactor, ningún archivo bajo `src/pages/ventas/` ni `src/pages/Ventas.tsx` MUST exceder 400 líneas.

#### Scenario: Auditoría de tamaños

- **WHEN** se ejecuta `find src/pages/ventas src/pages/Ventas.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`
- **THEN** ningún archivo individual reporta más de 400 líneas.
