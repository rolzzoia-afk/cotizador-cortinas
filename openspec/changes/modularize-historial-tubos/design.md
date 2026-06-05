# Diseño técnico: Modularizar HistorialTubos

## Contexto

`src/pages/HistorialTubos.tsx` tiene 1235 líneas con 11 funciones internas. Estructura actual (líneas aproximadas):

| Sección | Líneas |
|---|---:|
| Imports + tipos (`Evento`, `EvCfg`) | 1-63 |
| Constantes (`EV`, `FUENTE_CFG`, `PALETA`) | 65-84 |
| Helpers de formato (`formatFechaHora`, `formatMes`) | 86-101 |
| `export function HistorialTubos()` (orquestador) | 103-138 |
| `function TabButton({...})` | 139-218 |
| `function VistaTrazabilidad({ empresaId })` | 220-434 |
| `function FichaCard({...})` | 435-619 |
| `function FichaSeccion({...})` | 620-657 |
| `function VistaHistorial({ empresaId })` | 659-913 |
| `function EventoItem({ e })` | 914-1003 |
| `function VistaMerma({ empresaId })` | 1004-1217 |
| `function StatBox({ value, label })` | 1218-1228 |
| `function EmptyState({ children })` | 1229-1235 |

Las 3 vistas son **independientes** entre sí — no comparten estado, solo el `empresaId` que viene de `useAuth()`.

## Estructura objetivo

```
src/pages/HistorialTubos.tsx                       (~70 líneas, orquestador)
src/pages/historial-tubos/
├── HistorialTubos.types.ts                        (tipos: Evento, EvCfg)
├── HistorialTubos.config.ts                       (constantes: EV, FUENTE_CFG, PALETA)
├── utils/
│   └── formato-fechas.ts                          (formatFechaHora, formatMes)
├── components/
│   ├── TabButton.tsx                              (~85 líneas)
│   ├── EventoItem.tsx                             (~95)
│   ├── StatBox.tsx                                (~15)
│   ├── EmptyState.tsx                             (~12)
│   ├── FichaSeccion.tsx                           (~45)
│   └── FichaCard.tsx                              (~195, usa FichaSeccion)
└── vistas/
    ├── VistaTrazabilidad.tsx                      (~225, usa FichaCard)
    ├── VistaHistorial.tsx                         (~265, usa EventoItem, EmptyState)
    └── VistaMerma.tsx                             (~225, usa StatBox, EmptyState, PALETA)
```

## Decisiones

### Carpeta `src/pages/historial-tubos/` (no `src/components/historial-tubos/`)

La carpeta vive junto a `HistorialTubos.tsx` porque todos los componentes son privados a esta página: ningún otro archivo del proyecto los reutiliza. Mantener la cercanía hace que sea trivial encontrarlos al volver al código.

### Tipos y constantes en archivos hermanos al orquestador (no en `utils/`)

Los tipos (`Evento`, `EvCfg`) y la config visual (`EV`, `FUENTE_CFG`, `PALETA`) son compartidos por las 3 vistas y por varios helpers. Ponerlos en archivos hermanos del orquestador (`HistorialTubos.types.ts`, `HistorialTubos.config.ts`) hace evidente desde el nombre que son "de esta página".

### Las 3 vistas reciben `empresaId` como prop, no leen `useAuth` directo

Para que cada vista sea un componente puro fácil de testear y de leer en aislamiento, el orquestador es quien lee `useAuth()` y pasa `empresaId` por props. Igual que está hoy.

### `FichaCard` y `FichaSeccion` quedan en `components/` (no en `vistas/trazabilidad/`)

Aunque hoy solo los usa `VistaTrazabilidad`, conceptualmente son tarjetas de "ficha de tubo" reutilizables. Si en el futuro `VistaHistorial` quiere mostrar la ficha completa al hacer click en un evento, ya están en la carpeta compartida.

### `EventoItem` queda en `components/` por la misma razón

Aunque hoy solo lo usa `VistaHistorial`, es la representación visual de un evento — algo que podría aparecer en otras vistas más adelante.

### Importar la config (`EV`, `FUENTE_CFG`, `PALETA`) y no re-declararla

Cada vista que necesite los íconos/colores/labels los importa de `HistorialTubos.config.ts`. Las constantes son `const` exportadas, no se duplican.

### No cambiar nada de Supabase

Las queries siguen donde están dentro de cada vista. No se extrae a hooks separados porque cada vista hace su propia consulta de forma muy distinta y mover esto solo agrega indirección.

## Alternativas consideradas

### A. Carpeta `src/components/historial-tubos/`

Rechazada: el patrón establecido para una pantalla con muchos hijos privados es la carpeta hermana junto al archivo de la página (igual que `correcciones/` vive en `src/components/ojo-de-dios/correcciones/` junto a `Correcciones.tsx`).

### B. Un archivo único para los 3 helpers chicos (`TabButton`, `StatBox`, `EmptyState`)

Rechazada: una de las reglas del patrón es **un componente por archivo**. Tres archivos chiquitos son más buscables que un `helpers.tsx` mezclado.

### C. Hooks separados por vista

Rechazada: cada vista tiene una sola query a Supabase con su propio shape de resultado. Un hook separado no agrega valor y agrega indirección.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper la pantalla sin que nadie se dé cuenta | Verificación manual: abrir las 3 pestañas y confirmar datos vs. screenshots de antes |
| Imports rotos por typo | `npx tsc --noEmit --skipLibCheck` entre cada pasada |
| El stub `HistorialTubos.tsx` se queda con código viejo que ya nadie usa | Verificación final: `grep -c "function VistaTrazabilidad\|function VistaHistorial\|function VistaMerma\|function FichaCard\|function FichaSeccion\|function EventoItem\|function TabButton\|function StatBox\|function EmptyState" src/pages/HistorialTubos.tsx` debe dar 0 |

## Plan de ejecución

5 pasadas con verificación `tsc=0` entre cada una:

1. **Pasada 1** — Tipos + constantes + utils puros (sin componentes todavía).
2. **Pasada 2** — Componentes hoja sin dependencias internas: `TabButton`, `StatBox`, `EmptyState`, `EventoItem`, `FichaSeccion`.
3. **Pasada 3** — `FichaCard` (depende de `FichaSeccion`).
4. **Pasada 4** — Las 3 vistas: `VistaTrazabilidad` (depende de `FichaCard`), `VistaHistorial` (depende de `EventoItem`, `EmptyState`), `VistaMerma` (depende de `StatBox`, `EmptyState`, `PALETA`).
5. **Pasada final** — Adelgazar `HistorialTubos.tsx` a orquestador puro con el state del tab activo.
