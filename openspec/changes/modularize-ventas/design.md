# Diseño técnico: Modularizar Ventas

## Contexto

`src/pages/Ventas.tsx` (1228 líneas) tiene:
- 3 tipos (`KpiConfig`, `Periodo`, `Registro`) — líneas 54-68.
- 2 constantes (`DEFAULT_CONFIG`, `CANAL_COLORS`) — líneas 73-90.
- 4 helpers puros (`hoyISO`, `slugify`, `iniciales`, `colorPct`) — líneas 92-118.
- 4 componentes UI: `SectionHeader` (~30), `Gauge` (~57), `NumInput` (~32), `ChipList` (~27) — líneas 123-281.
- `ConfigDialog` (~160 líneas) — líneas 286-444.
- `Ventas()` (~780 líneas) — líneas 449-1227, con 6 secciones inline.

Las 6 secciones son visuales independientes (cada una un `rounded-2xl border` distinto). Comparten state vía `getVal/setVal` que viven en el orquestador.

## Estructura objetivo

```
src/pages/Ventas.tsx                                 (~250 líneas, orquestador)
src/pages/ventas/
├── Ventas.types.ts                                  (~25 — 3 tipos)
├── Ventas.config.ts                                 (~30 — DEFAULT_CONFIG, CANAL_COLORS)
├── utils/
│   └── helpers.ts                                   (~35 — 4 helpers)
├── components/
│   ├── SectionHeader.tsx                            (~35)
│   ├── Gauge.tsx                                    (~60)
│   ├── NumInput.tsx                                 (~35)
│   ├── ChipList.tsx                                 (~30)
│   └── ConfigDialog.tsx                             (~165)
└── secciones/
    ├── CanalesSection.tsx                           (~105)
    ├── LlamadasSection.tsx                          (~115)
    ├── MetaVisitasSection.tsx                       (~65)
    ├── CierreSection.tsx                            (~75)
    ├── TerrenoSection.tsx                           (~125)
    └── HistorialSection.tsx                         (~75)
```

## Decisiones

### Las 6 secciones reciben slices de state + setters por props

Las 6 secciones necesitan acceso a `config`, `registros`, `setVal`, y a memos derivados (`totalCanales`, `canalesChartData`, `terrenoData`). El orquestador centraliza todo eso y pasa solo lo que cada sección necesita:

- `CanalesSection`: `config.canales`, `totalCanales`, `canalesChartData`, `getVal`, `setVal`.
- `LlamadasSection`: `config.vendedoras`, `totalCanales`, `totalLlamadas`, `getVal`, `setVal`.
- `MetaVisitasSection`: `config.vendedoras`, `config.meta_visitas`, `getVal`, `setVal`.
- `CierreSection`: `envVal`, `cerVal`, `errorCierre`, `pctCierre`, `pendientes`, `setVal`.
- `TerrenoSection`: `terrenoData`, `setVal`.
- `HistorialSection`: `historial`, `periodo`.

Beneficios: cada sección puede testearse en aislamiento dándole props estáticos; el orquestador deja claro de un vistazo qué memos alimentan a qué sección.

### Helpers en `utils/helpers.ts`, no en archivo separado por función

Los 4 helpers son cortos (3-8 líneas cada uno) y conceptualmente del mismo grupo (formato/utilidades de cadenas/colores). Un archivo único reduce ruido de archivos chiquitos.

### Hooks separados — decisión: NO

Considerado: extraer un `useVentasData()` con el state + las 3 queries + el upsert. Rechazado: el orquestador con todo eso queda igual de claro y separar suma indirección sin valor (cada query es de 5 líneas, no se reusa en otro lugar). Si en el futuro la pantalla crece más, sale fácil ahí.

### `ConfigDialog` queda en `components/` y no en `secciones/`

Es un modal, no una sección del dashboard. La carpeta `components/` es para UI compartida; el dialog encaja ahí.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper el upsert de registros | Las queries quedan idénticas en el orquestador (no se mueven a hooks) — verificable con diff |
| Pasar mal props entre orquestador y secciones | `tsc=0` entre cada pasada |
| Romper el config dialog (es el único que muta `kpi_config`) | Se extrae 1:1, sin tocar la lógica |
| Truncado del linter | Usar `cat << EOF` desde bash para archivos > 80 líneas |

## Plan de ejecución

4 pasadas con verificación `tsc=0` entre cada una:

1. **Pasada 1** — Tipos + constantes + utils helpers (todo lo no-React).
2. **Pasada 2** — Componentes hoja: `SectionHeader`, `Gauge`, `NumInput`, `ChipList`, `ConfigDialog`.
3. **Pasada 3** — Las 6 secciones.
4. **Pasada final** — Adelgazar `Ventas.tsx` a orquestador (state + queries + memos + grid de secciones).
