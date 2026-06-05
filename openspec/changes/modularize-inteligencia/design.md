# Diseño técnico: Modularizar Inteligencia

## Contexto

`src/pages/Inteligencia.tsx` tiene 1813 líneas con:
- 5 tipos de dominio: `OT`, `Insumo`, `Mov`, `Rack`, `ErrorCorte` (líneas 47-103).
- 4 constantes: `ESTADOS_ACTIVOS`, `ESTADOS_PRODUCCION`, `COLORES_ERROR`, `CHIPS` (líneas 105-127 y 252-276).
- 6 utils de formato puros: `fmt`, `diasDesde`, `diasHasta`, `fmtFecha`, `fmtFechaHora`, `dgStr` (líneas 128-174).
- 3 componentes compartidos: `GlassCard` (~56 líneas), `EmptyState` (~9), `Spinner` (~12).
- 1 helper grande de texto: `generarTextoDiag(ots, insumos, movs, racks): string` (~140 líneas).
- 1 dialog: `DiagDialog` (~108 líneas).
- El orquestador `Inteligencia()` (~302 líneas): carga datos + memos derivados + render.
- **9 cards independientes**: `KPICard` (~34), `CrossAlertsCard` (~124), `OTRiskCard` (~129), `ConsumoCard` (~108), `ErroresCorteCard` (~114), `RestockCard` (~82), `ActivityCard` (~94), `InsightsCard` (~133), `StockGeneralCard` (~168).

El orquestador hace 6 queries Supabase en paralelo (`Promise.all`) cada vez que se carga, y auto-refresca cada 5 minutos.

## Estructura objetivo

```
src/pages/Inteligencia.tsx                          (~150 líneas, orquestador)
src/pages/inteligencia/
├── Inteligencia.types.ts                           (~60 — 5 tipos)
├── Inteligencia.config.ts                          (~50 — constantes + CHIPS)
├── hooks/
│   └── useInteligenciaData.ts                      (~95 — carga + auto-refresh)
├── utils/
│   ├── formato.ts                                  (~50 — 6 helpers de fecha/número)
│   └── generar-texto-diag.ts                       (~145)
├── components/
│   ├── GlassCard.tsx                               (~60)
│   ├── EmptyState.tsx                              (~15)
│   ├── Spinner.tsx                                 (~15)
│   └── DiagDialog.tsx                              (~115)
└── cards/
    ├── KPICard.tsx                                 (~40)
    ├── CrossAlertsCard.tsx                         (~130)
    ├── OTRiskCard.tsx                              (~135)
    ├── ConsumoCard.tsx                             (~115)
    ├── ErroresCorteCard.tsx                        (~120)
    ├── RestockCard.tsx                             (~90)
    ├── ActivityCard.tsx                            (~100)
    ├── InsightsCard.tsx                            (~140)
    └── StockGeneralCard.tsx                        (~175)
```

## Decisiones

### Hook `useInteligenciaData()` para encapsular las 6 queries

El orquestador hoy mezcla state (`ots`, `insumos`, `movs`, `movsHoy`, `racks`, `errores`, `loading`, `refreshing`, `lastUpdate`) + función `cargarTodo()` + efecto de polling cada 5 minutos. Toda esa parte sale a un hook custom `useInteligenciaData()` que devuelve `{ ots, insumos, movs, movsHoy, racks, errores, loading, refreshing, lastUpdate, refresh }`. Beneficios:

- El orquestador queda enfocado en composición y memos derivados.
- Si en el futuro queremos cambiar la carga (paginar, websockets, swr…), el blast radius es un solo archivo.
- Es trivial reutilizar el hook desde otro lugar si alguna vez se necesita el mismo dataset.

### Memos derivados (otsActivas, stockBajo…) **se quedan** en el orquestador

Los 6 memos (`otsActivas`, `otsProduccion`, `stockBajo`, `otsSinMov`, `salidas`, `consumoMap`) se quedan en `Inteligencia.tsx` y se pasan a las cards como props. Justificación: cada memo se usa en 1-3 cards distintas; centralizarlo en el orquestador evita recalcular en cada card y deja claro en una sola vista qué slices alimentan a quién.

### Carpeta `src/pages/inteligencia/` (no `src/components/inteligencia/`)

Mismo criterio que con `historial-tubos/`: todos los componentes son privados a esta página, ningún otro archivo los reutiliza, y vivir junto al orquestador hace que sea trivial encontrarlos al volver al código.

### Las 9 cards son archivos hermanos, no anidadas por "fila"

Las 9 cards están agrupadas hoy en 4 filas visuales del layout. Las pongo todas planas en `cards/` (no `cards/fila-1/`, `cards/fila-2/`) porque las filas pueden cambiar con el layout y la agrupación no aporta nada conceptualmente — cada card es independiente.

### `GlassCard`, `EmptyState`, `Spinner` y `KPICard` quedan en `components/` y `cards/` respectivamente

- `GlassCard`, `EmptyState`, `Spinner` son componentes de UI **compartidos** entre cards → `components/`.
- `KPICard` es una **card** del dashboard aunque sea chiquita → `cards/`, para consistencia con las otras 8.

### `generarTextoDiag` y `DiagDialog` separados

`generarTextoDiag(ots, insumos, movs, racks): string` es **pura lógica de generación de texto** (140 líneas que arman un reporte markdown) — va a `utils/generar-texto-diag.ts`. El componente `DiagDialog` que lo consume y maneja la UI del modal va a `components/DiagDialog.tsx`. Beneficio: si mañana queremos exportar el diag a otro formato (PDF, email), reutilizamos `generarTextoDiag` directamente.

## Alternativas consideradas

### A. Una sola carpeta plana sin subcarpetas

Rechazada: 17 archivos planos sería ruidoso. La separación en `components/` (UI compartida), `cards/` (cards del dashboard), `utils/` (lógica pura), `hooks/` (carga de datos) es ortogonal y semánticamente clara.

### B. Extraer también los memos derivados (otsActivas, stockBajo…) a un hook

Rechazada: los memos son derivaciones triviales (1-3 líneas cada uno) que solo se usan dentro del orquestador. Sacarlos a un hook agrega indirección sin valor. El orquestador queda con ~150 líneas, lo cual está dentro del límite y deja la composición clara.

### C. Una card por fila visual (Fila1Cards.tsx, Fila2Cards.tsx, …)

Rechazada: las "filas" son un detalle del layout que puede cambiar (responsive, reordenamiento). Las 9 cards son la unidad lógica natural.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper una card sin que nadie se dé cuenta | Verificación manual: abrir la pantalla con un usuario que tenga datos reales y comparar cada card vs. screenshots de antes |
| Pasar mal una prop al refactorizar | `npx tsc --noEmit --skipLibCheck` entre cada pasada |
| Romper el auto-refresh de 5 minutos | El hook `useInteligenciaData` mantiene el mismo `useEffect` con setInterval idéntico — verificar manualmente que sigue refrescando |
| Truncado del linter en archivos grandes | Usar `cat << EOF` desde bash para escribir los archivos >150 líneas |

## Plan de ejecución

5 pasadas con verificación `tsc=0` entre cada una:

1. **Pasada 1** — Tipos, constantes, utils, `generarTextoDiag` (todo lo no-React).
2. **Pasada 2** — Hook `useInteligenciaData`.
3. **Pasada 3** — Componentes hoja: `GlassCard`, `EmptyState`, `Spinner`, `DiagDialog`.
4. **Pasada 4** — Las 9 cards.
5. **Pasada final** — Adelgazar `Inteligencia.tsx` a orquestador puro.
