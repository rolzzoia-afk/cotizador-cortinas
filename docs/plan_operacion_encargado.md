# Checklist de lanzamiento del optimizador

**Contexto:** el optimizador hoy NO está en uso productivo. La meta es dejarlo listo para que cualquier persona (un encargado del taller, no Antonio, no un desarrollador) pueda **usarlo y resolver problemas sin pedir ayuda**.

**Cómo leer este documento:** la sección 3 es la lista. Cada ítem tiene un criterio claro de "✅ está listo". Cuando estén todos marcados, el sistema se puede soltar.

---

## 1. Resumen en 1 minuto

- La base está sólida: el optimizador funciona, hay infraestructura de corrección, el modelo de datos cubre los 10 escenarios típicos del taller, los triggers protegen la consistencia.
- Faltan **6 cosas concretas** para poder soltarlo (sección 3). De esas, **3 son cambios de software**, **3 son decisiones / capacitación**.
- El cambio de software más importante es la **corrección retroactiva** — sin eso, el encargado tiene que escalar cada vez que un problema aparece "tarde" (más de un plan después).
- Las decisiones operativas (roles, escalamiento, manual) NO requieren código y se pueden cerrar en paralelo a la parte técnica.

---

## 2. Punto de partida — lo que ya está bien

No hace falta tocar nada de esto. Se enumera para que se sepa que NO está pendiente.

| Pieza | Para qué sirve | Estado |
|---|---|---|
| Optimizador legacy (HTML) | Cargar inventario, optimizar, descargar Excel, guardar plan | ✅ Funcionando (tras fixes del 15/05) |
| Pestaña Correcciones (Ojo de Dios) | Corregir 4 tipos de error en el **último** plan | ✅ Funcionando |
| Pestaña Reconciliación | Detectar planes huérfanos y tubos fantasma (cada 60 s) | ✅ Funcionando |
| Pestaña Colmena | Vista del inventario + restaurar plan histórico (nuclear) | ✅ Funcionando |
| Triggers de BD | Mantienen `colmena_tubos` consistente automáticamente | ✅ Activos |
| Audit log | Cada cambio en tablas críticas queda registrado | ✅ Activo |
| Eventos del historial (10 tipos) | Modelo de datos contempla todos los escenarios | ✅ Definidos |

---

## 3. Checklist de lanzamiento

### 🚧 Bloqueadores — sin esto, no se puede soltar

#### ☐ B1 · Definir y configurar los roles en la app

**Qué hay que decidir:** quién puede ver y hacer qué. Propuesta de partida:

| Rol | Qué hace | Qué NO hace |
|---|---|---|
| **Optimizador** | Carga OTs, genera planes, descarga Excel | No accede a Ojo de Dios |
| **Encargado** | Ojo de Dios → Correcciones, Colmena (solo lectura), Reconciliación (solo lectura). Resuelve los 4 casos típicos | No restaura planes históricos. No corre SQL. No edita inventario directo |
| **Admin** | Todo. Único que puede restaurar planes históricos, correr SQL, hacer cargas iniciales | — |

**✅ listo cuando:**
- La app distingue los 3 roles al iniciar sesión.
- Las acciones destructivas (botón "Restaurar plan", panel de admin) solo aparecen para el rol admin.
- El encargado ve la pestaña Correcciones pero NO el botón Restaurar de la pestaña Colmena.

**Quién lo puede hacer:** desarrollador (1-2 días). Si el sistema ya tiene roles definidos a nivel de auth, puede ser solo una decisión de configuración.

---

#### ☐ B2 · Cerrar el gap de corrección retroactiva (escenario E2)

**El problema:** hoy solo se puede corregir el plan **más reciente**. Si un tubo aparece dañado y ya hay 3 planes posteriores, el encargado no tiene flujo limpio y tiene que escalar a admin.

**Diseño propuesto** (suficiente para un dev arme la implementación):

- En Correcciones, agregar selector "Plan a corregir" — lista los últimos 30 planes.
- Al elegir un plan antiguo y marcar una línea como `tubo_danado` / `tubo_equivocado` / `medida_erronea`:
  - **No se rebobina el inventario.**
  - Se registra el evento `error_reemplazo` en `tubos_historial` apuntando al tubo problemático del plan antiguo.
  - Se inserta una fila en `correcciones` con `plan_id = <id del plan antiguo>` (igual que hoy con el plan reciente).
  - Se genera un mini-plan nuevo (`tipo = 'correccion_retroactiva'`) que tiene SOLO la línea a rehacer, con un tubo distinto del mismo código.
  - El encargado corta ese mini-plan como cualquier otro.
- La trazabilidad queda: el plan antiguo conserva su línea original (no se edita), aparece un registro de corrección que lo enlaza al mini-plan, y el mini-plan tiene la versión corregida.

**Por qué es seguro:** este flujo solo AGREGA eventos al historial. No edita planes viejos, no toca `colmena_tubos` directamente (lo hace via el optimizador con su flujo normal), y respeta los triggers existentes.

**✅ listo cuando:**
- Desde Correcciones, se puede elegir cualquiera de los últimos 30 planes para corregir.
- Aplicar una corrección sobre un plan antiguo genera un mini-plan visible en el historial.
- El inventario actual no se altera por la corrección (no rebobina).
- La OT afectada queda etiquetada con la corrección, no perdida en el aire.
- Hay un test manual end-to-end: cortar plan A, después plan B y C, descubrir defecto en A, corregir A vía retroactiva, cortar el mini-plan → todo consistente al final.

**Quién lo puede hacer:** desarrollador, ~1-2 semanas. Requiere: cambio en `Correcciones.tsx` + nuevo RPC (`generar_correccion_retroactiva`) + un nuevo `tipo` en `planes_corte`. Yo puedo redactar el spec técnico cuando sea necesario.

---

#### ☐ B3 · Manual del encargado validado en vivo

**Qué falta:** el manual existe (sección 4 de este documento). Pero un manual escrito no sirve si la persona real que lo va a usar no lo probó.

**✅ listo cuando:**
- La persona que va a ser el encargado leyó el manual.
- Hizo al menos **un ciclo completo simulado** de cada uno de los 4 casos típicos (E1, E3, E4, E5).
- Después de la simulación, ajustamos el manual con lo que no quedó claro (siempre hay algo).

**Quién lo puede hacer:** Antonio + el encargado. Medio día de sesión práctica.

---

### ⚙️ Importantes — el sistema funciona sin esto, pero el encargado va a sufrir

#### ☐ I1 · UI con lenguaje del taller (no del modelo de datos)

Hoy la pestaña Correcciones dice cosas como "linea_idx", "medida_cm", "tubo_raiz_id". Para el encargado, deberían leerse como "Línea del plan", "Medida en cm", "ID interno del tubo (no editar)".

**✅ listo cuando:** un encargado nuevo no necesita preguntar qué significa ninguna columna ni botón.

**Quién:** desarrollador, ~2-3 días. No es funcional, es de pulido — pero es la diferencia entre "usable" y "frustrante".

---

#### ☐ I2 · Confirmaciones explícitas antes de acciones irreversibles

Cada acción destructiva tiene que tener un modal "¿Confirmás? Esta acción no se puede deshacer fácilmente" — con un resumen claro de qué va a pasar.

**Específicamente:**
- Aplicar correcciones (debe mostrar: "vas a corregir N líneas del plan X, esto crea un nuevo plan corregido").
- Restaurar plan histórico (debe mostrar: "vas a rebobinar el inventario al estado del plan X, perdiendo M planes posteriores").
- Confirmar guardar plan en el optimizador (ya lo tiene, validar que está claro).

**✅ listo cuando:** ninguna acción destructiva se ejecuta con un solo clic.

**Quién:** desarrollador, 1 día.

---

#### ☐ I3 · Reporte resumen post-corte

Después de cada plan confirmado, mostrar (en la propia pantalla, no en un reporte aparte) una vista de "qué pasó":
- Cuántos tubos cortados, cuántos sobrantes generados, cuánta merma.
- Qué OTs quedaron completas.
- Si hubo correcciones aplicadas en este plan.

**✅ listo cuando:** el encargado puede ver el resumen sin abrir otra pestaña.

**Quién:** desarrollador, 1-2 días. Es valor agregado, no funcional crítico.

---

### 💭 Para después — agregar cuando el sistema ya esté en uso

Estos no bloquean lanzamiento. Cuando se vea uso real, se prioriza con datos de la práctica.

- **D1 · Wizards por escenario** — UI tipo "¿qué problema tenés?" que lleva al encargado al flujo correcto.
- **D2 · Reportes operativos semanales** — top errores, OTs con más correcciones, eficiencia de uso de tubos.
- **D3 · Reemplazo del optimizador legacy** — pasar la pantalla del optimizador HTML a la app React. Hoy no toca porque funciona y reemplazarlo es un proyecto en sí mismo.
- **D4 · Asistente "qué hago si..."** — chatbot/dropdown que guía al encargado por los escenarios.

---

## 4. Manual del encargado

Esta es la sección para imprimir, compartir, o pegar en la wiki del equipo. Vale para entrenar al encargado **ahora** (cubriendo los 4 casos que ya funcionan) y se actualiza cuando los bloqueadores B1 y B2 estén listos.

### Antes de empezar

- Tener acceso a Ojo de Dios.
- Saber tu rol: vos resolvés los casos comunes; los raros se anotan y se escalan.
- **Regla de oro:** si dudás, parás y consultás. Mejor 10 minutos parado que 10 horas reparando.

### Caso 1 — "Voy a cortar un tubo del plan y vino con falla / estaba mal medido"

**Si el plan es el más reciente** (lo más común al inicio):

1. Andá a **Ojo de Dios → Correcciones**.
2. Encontrá la línea del tubo problemático.
3. Hacé clic en "Editar línea" y elegí el tipo:
   - **Medida errónea** → la medida real.
   - **Tubo equivocado** → el código real.
   - **Tubo dañado** → así queda registrado como inutilizable.
4. **Aplicar correcciones**. Se genera un plan corregido.
5. Volvé al optimizador para recortar la línea con otro tubo del mismo código.

**Si el plan NO es el más reciente** (ya hay planes después):

- Por ahora no podés hacerlo solo. **Esto se habilita cuando esté el bloqueador B2.**
- Mientras tanto: anotá la OT, el tubo, la fecha del plan original, **sacá el tubo defectuoso de la colmena** (físicamente) y **escalá a Antonio**.

### Caso 2 — "El operario cortó mal"

Mismo flujo que el Caso 1 — la pestaña Correcciones cubre `tubo_equivocado` y `medida_erronea`.

### Caso 3 — "Encontré un tubo físico que no está en el sistema"

- 1 o 2 tubos sueltos → **escalá** (admin los agrega).
- Un lote entero (recepción) → **escalá** (corresponde una carga inicial).

### Caso 4 — "El sistema dice que hay un sobrante, pero no aparece"

- Buscalo bien primero (slots A27/A28/A29 si era peso, colmenas cercanas).
- Si confirmás que no está, anotalo y escalá. El admin registra un `eliminado` con motivo.

### Caso 5 — "El guardado se quedó cargando y no descargó el Excel"

- **No reintentar varias veces** — cada intento puede mover datos.
- Recargá con **Ctrl+Shift+R**.
- Hacé **Cargar desde Supabase** para refrescar.
- Probá una vez más. Si falla otra vez, copiá el mensaje de error y escalá.

### Caso 6 — "El cliente canceló la OT después de confirmar el plan"

- **Escalá siempre.** Hay que decidir entre restaurar el snapshot o hacer un plan correctivo.

### Caso 7 — "Aparece un cartel raro en Reconciliación"

- Anotá lo que dice y la fecha.
- **Escalá.** Reconciliación es diagnóstico, no acción.

### Lo que el encargado NUNCA hace solo
- Correr SQL directo en Supabase.
- "Restaurar plan" desde la pestaña Colmena.
- Editar `colmena_tubos` o `tubos_historial` desde un editor externo.
- Borrar planes.

### Escalamiento
Anotá siempre: **fecha y hora, OT afectada, tubo (colmena/código/medida), qué pasó, qué intentaste**. Después escalá por el canal acordado (chat/email/lo que sea).

---

## 5. Riesgos y salvaguardas

**Lo que ya protege:**
- Triggers de la BD: si alguien intenta dejar un tubo en estado inconsistente, lo bloquea automáticamente.
- Audit log: cada cambio queda registrado.
- Reconciliación automática: detecta drift cada 60 s.
- Las correcciones generan PLAN NUEVO en vez de editar el viejo — el historial es inmutable.
- Snapshots automáticos: cada plan crea un respaldo previo.

**Riesgo específico del cambio B2 (corrección retroactiva):** si se implementa con bugs, podría dejar mini-planes huérfanos. **Mitigación:** que el mini-plan SIEMPRE quede visible en el historial con un enlace al plan original, y que la Reconciliación lo detecte si queda sin cortar después de N horas.

**Riesgo de no hacer B2:** el encargado escala el caso E2 cada vez que pasa (1-2 veces por semana esperable), Antonio queda como cuello de botella → el sistema no es realmente self-service.

---

## 6. Próximos pasos concretos

En este orden:

1. **Decisión sobre B1 (roles):** revisar la propuesta de roles de la sección 3.B1. Aprobar o ajustar.
2. **Decisión sobre B2 (corrección retroactiva):** confirmar el diseño propuesto. Si hay matices del taller (cómo se llaman las cosas, qué pasos físicos hace el operario), incorporarlos al spec antes de implementar.
3. **Implementar B1 y B2 en ese orden.** B1 es más rápido y desbloquea el resto. B2 es el cambio importante.
4. **En paralelo:** preparar el entrenamiento del encargado con la versión actual del manual (sección 4), agregando lo de B2 cuando esté listo.
5. **Sesión de pruebas end-to-end** con el encargado real, simulando los 4 casos comunes + el caso E2 corregido por B2.
6. **Lanzar** cuando los 6 bloqueadores estén ✅.

---

## Changelog

- **2026-05-15 v1** — Plan inicial framing "operación activa".
- **2026-05-15 v2** — Reframeado a checklist de pre-lanzamiento. La V1 asumía sistema en producción, no aplica.
