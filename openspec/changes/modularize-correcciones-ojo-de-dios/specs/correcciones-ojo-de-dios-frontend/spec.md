## ADDED Requirements

### Requirement: Tamaño máximo de archivo

Todo archivo `.ts` o `.tsx` dentro de `src/components/ojo-de-dios/correcciones/` y el orquestador `src/components/ojo-de-dios/Correcciones.tsx` SHALL tener un máximo de 400 líneas de código.

#### Scenario: Verificación de tamaño con wc -l

- **WHEN** se corre `find src/components/ojo-de-dios/correcciones src/components/ojo-de-dios/Correcciones.tsx -name "*.ts" -o -name "*.tsx" | xargs wc -l`
- **THEN** ningún archivo de la lista supera las 400 líneas

### Requirement: Orquestador adelgazado

El archivo `src/components/ojo-de-dios/Correcciones.tsx` SHALL ser un orquestador puro: solo importa hooks de `@/modules/admin/correcciones`, llama esos hooks, y compone los subcomponentes hijos. No contiene lógica de UI propia (>10 líneas de JSX inline).

#### Scenario: Inspección del orquestador

- **WHEN** se inspecciona `src/components/ojo-de-dios/Correcciones.tsx`
- **THEN** el archivo tiene menos de 100 líneas
- **THEN** el archivo NO contiene funciones internas adicionales al `export function Correcciones`

### Requirement: Subcomponentes en carpeta dedicada

Las 8 funciones React internas del archivo original SHALL vivir en archivos propios dentro de `src/components/ojo-de-dios/correcciones/`, uno por archivo.

#### Scenario: Inspección de carpeta correcciones/

- **WHEN** se inspecciona `src/components/ojo-de-dios/correcciones/`
- **THEN** existen los archivos: `SaludColmenaWidget.tsx`, `ConfigOptimizador.tsx`, `PlanActivoSection.tsx`, `CorreccionRetroactivaSection.tsx`, `EditorLinea.tsx`, `HistorialCorrecciones.tsx`, `HistorialPlanes.tsx`, `HintColmenaDuplicada.tsx`
- **THEN** cada archivo exporta un único componente React por default

### Requirement: Función auxiliar en utils/

La función pura `extraerOTsPlan` SHALL vivir en `src/components/ojo-de-dios/correcciones/utils/extraer-ots-plan.ts` y ser importada por los componentes que la usan (en vez de duplicarse o quedar inline en el orquestador).

#### Scenario: Inspección de utils/

- **WHEN** se inspecciona `src/components/ojo-de-dios/correcciones/utils/extraer-ots-plan.ts`
- **THEN** el archivo existe y exporta una función `extraerOTsPlan(plan: PlanResumen): string[]`

#### Scenario: No duplicación

- **WHEN** se busca `function extraerOTsPlan` en todo `src/components/ojo-de-dios/`
- **THEN** la función aparece definida exactamente una vez (en `utils/extraer-ots-plan.ts`)

### Requirement: Compatibilidad de API externa

El export `Correcciones` desde `src/components/ojo-de-dios/Correcciones.tsx` SHALL mantenerse igual que antes del refactor. El consumidor `src/pages/OjoDeDios.tsx` no requiere ningún cambio.

#### Scenario: Import en OjoDeDios.tsx

- **WHEN** se inspecciona `src/pages/OjoDeDios.tsx`
- **THEN** la línea `import { Correcciones } from '@/components/ojo-de-dios/Correcciones';` no cambia respecto del estado pre-refactor

### Requirement: TypeScript sin errores

El proyecto SHALL compilar sin errores con `npx tsc --noEmit --skipLibCheck` después del refactor.

#### Scenario: Verificación con tsc

- **WHEN** se ejecuta `npx tsc --noEmit --skipLibCheck` desde la raíz del proyecto
- **THEN** el comando devuelve exit code 0 y no imprime errores `error TS*`

### Requirement: Comportamiento del módulo sin regresiones

El refactor SHALL preservar exactamente el comportamiento funcional. Todas las acciones que el operario podía hacer antes deben seguir funcionando idénticamente.

#### Scenario: Semáforo de salud

- **WHEN** un usuario admin abre Ojo de Dios → Correcciones
- **THEN** el `SaludColmenaWidget` aparece arriba de todo y muestra estado verde/ámbar/rojo con la cantidad de tubos

#### Scenario: Plan activo

- **WHEN** el usuario aprieta "Cargar" en la sección Plan de corte activo
- **THEN** se carga el último plan y aparece la tabla de líneas con botón ✏ por fila
- **WHEN** el usuario aprieta ✏ en una línea
- **THEN** se abre el `EditorLinea` donde puede marcar tipo de error y nota

#### Scenario: Corrección retroactiva

- **WHEN** el usuario selecciona un plan antiguo en el dropdown de Corrección retroactiva
- **THEN** se carga la tabla del plan y puede marcar líneas con ✏
- **WHEN** confirma una corrección
- **THEN** se registra el error sin modificar el inventario

#### Scenario: Historial de planes

- **WHEN** el usuario aprieta "Cargar" en Historial de planes
- **THEN** aparece la lista de planes pasados con cantidad de cortes y OTs
- **WHEN** el usuario aprieta "Vista previa" sobre un plan
- **THEN** se abre el dialog con las líneas del plan
- **WHEN** el usuario aprieta "Restaurar este plan como activo"
- **THEN** la restauración se aplica y muestra el resultado (count_antes / count_despues + tubos_omitidos si hay)

#### Scenario: Hint visible

- **WHEN** el usuario llega al final del módulo
- **THEN** ve el bloque `HintColmenaDuplicada` con el aviso ámbar sobre tubos duplicados
