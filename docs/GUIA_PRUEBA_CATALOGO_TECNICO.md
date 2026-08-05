# Guía de prueba — Catálogo técnico

Cómo comprobar que todo lo que se configura en **Admin → Catálogo técnico** hace
lo que uno espera, antes de vender con eso.

La herramienta central es **Probar una cortina**, el primer cuadro de la
pantalla. Arma una cortina imaginaria y muestra lo que la app decidiría con la
configuración guardada: el modelo, el kit (y por qué regla lo eligió), el tubo,
la cadena, cada corte con su código de bodega y los insumos del paño. **No es
una simulación aparte**: llama a las mismas funciones que Fase 2 y Fase 4, así
que lo que se ve ahí es lo que va a salir en la orden real.

Cada sección de abajo tiene la misma forma: **qué tocar**, **qué debe pasar** y
**cómo volver atrás**. Todas las secciones del Catálogo técnico guardan un
respaldo automático antes de cada cambio, así que siempre se puede deshacer.

---

## 0. Antes de empezar

- Trabaja con calma: lo que se guarda acá **afecta a las OTs nuevas de
  inmediato**. Las ya guardadas conservan lo suyo.
- Después de guardar cualquier sección, el banco de pruebas se actualiza solo.
  Si tocaste algo y el banco no se movió, es que todavía no guardaste.
- Prueba de humo (30 segundos): abre el banco con **ROL · 1,50 × 2,40 · BCO**.
  Debe mostrar kit blanco `[MEC 33]`, tubo de 38 mm, cadena blanca de 4 m,
  tapas TAP19 y TAP01 con 2 tornillos TOR02, y **ningún aviso**. Si eso está
  bien, la configuración base está sana.

---

## 1. Leer el banco de pruebas

| Cuadro | Qué mirar |
|---|---|
| Modelo de fabricación | La fila del catálogo que se usó. Si dice «sin fila en el catálogo», esa categoría no tiene modelo y el despiece sale en cero. |
| Kit de mecanismo | El kit elegido y, debajo, **por qué**: regla por ancho, regla por categoría, kit por color, o «lo elige el vendedor». |
| Tubería | El tubo que quedaría en el paño. |
| Cadena automática | El código CAD que se auto-seleccionaría por alto y color. |
| Cortes | Cada pieza con su medida y su código de bodega. Un guion en Código significa que esa pieza no tiene código para ese color. |
| Insumos | Lo que bajaría a bodega por paño: tapas, tornillos, brackets, tarugos. |
| Revisa esto | Avisos: piezas sin catalogar, kit manual, cadena que no existe en inventario. |

**Referencias conocidas** (sirven para saber que el motor está sano):

- DARK 38 mm, INTERNO, ancho 2,00 m → 199,7 · 198,7 · 193,9 · 193,3 · 193,5
- OSCURANTI 63 mm, INTERNO, ancho 3,30 m → 329,7 · 323,9 · 323,3 · 323,5

---

## 2. Modelos de despiece

**Qué tocar** — En *Modelos de despiece*, cambia el «Dcto. tubo» de la fila
`MANUAL_38` de 3,8 a 5 y guarda.

**Qué debe pasar** — En el banco, con ROL 1,50 m, el corte del Tubo baja de
146,2 a 145 cm. También se mueve en el cuadro de fórmulas de esa familia.

**Prueba extra (la importante)** — Vuelve a importar el Excel maestro desde
*Modelos de despiece*. Tu edición **debe sobrevivir**: la app manda sobre el
Excel, y la fila quedó marcada como manual. Antes de esto, cada importación
pisaba lo editado a mano.

**Volver atrás** — Restaurar respaldo en la misma sección.

---

## 3. Fórmulas por tipo de cortina

**Qué tocar** — En *Fórmulas por tipo de cortina*, busca el cuadro
`DARK_38mm · INTERNO` y cambia el paso al tubo de 4,8 a 10.

**Qué debe pasar** — El total del cuadro se mueve mientras escribes. Al guardar,
el banco con DARK 38 INTERNO a 2,00 m muestra Tubo 188,7 en vez de 193,9, y la
tela lo sigue (la cadena arrastra). La cenefa delantera **no** se mueve: está
antes en la cadena.

**Prueba extra** — El perfil inferior también responde: cambia el ajuste de la
base y verifica que el corte se mueva en el banco, no solo en la vista previa.

**Volver atrás** — Restaurar respaldo de fórmulas.

---

## 4. Reglas de selección (tubo y mecanismo)

**Qué tocar** — En *Mecanismos*, la regla por ancho de la banda 2,2–3,0 m: baja
el mínimo a 2,0. Guarda.

**Qué debe pasar** — En el banco, con ROL de 2,10 m y el toggle «Tubo E78
activado» encendido, el kit pasa de `[MEC 33]` a `[MEC 18]` y abajo dice «regla
por ancho». Con el toggle apagado sigue en `[MEC 33]`: la banda es opt-in por OT.

**Otras dos que conviene probar**

- **Ocultar un tubo**: ponlo en «Oculto». Deja de ofrecerse en Fase 2, pero una
  OT vieja que lo tenga guardado lo sigue calculando y mostrando.
- **Un MEC que no existe**: escribe en una regla un número de kit que no esté en
  el catálogo. La pantalla lo marca en rojo y **no deja guardar**. Antes esto
  fallaba en silencio: la regla se ignoraba y decidía la siguiente.

**Volver atrás** — Restaurar respaldo de reglas.

---

## 5. Tipos de cortina propios

**Qué tocar** — *Tipos de cortina propios* → Agregar. Nombre «Dark de prueba»,
categoría `DARK_PRUEBA_38mm`, molde `DARK_38mm`. En el paso de números, cambia
el paso al tubo. Deja marcado «copiar las reglas del molde». Guarda.

**Qué debe pasar**

1. En el banco, el tipo nuevo aparece en el selector de categoría.
2. Sus cortes usan tu número; **el DARK nativo sigue igual** (elígelo y compara).
3. En Fase 1, el tipo aparece en el selector de categoría de una ventana.
4. Su cuadro propio aparece en *Fórmulas por tipo de cortina*.

**Prueba extra** — Desactívalo con el interruptor: sale de los selectores, pero
una OT que ya lo tenga guardado **se sigue calculando igual**. Al eliminarlo, la
app cuenta cuántas OTs lo usan y avisa antes.

**Volver atrás** — Eliminar el tipo (o restaurar respaldo de reglas).

---

## 6. El kit sigue al color de accesorios

**Qué tocar** — En una OT de prueba en Fase 2, abre una ventana con kit blanco y
toca el botón **NEG** de Color accesorios.

**Qué debe pasar** — Cambian juntos el kit (`[MEC 32]`) y la cadena (a negra).
Antes solo cambiaba la cadena y el kit quedaba en blanco.

**Casos que conviene mirar**

- Kit **reforzado** blanco + NEG → reforzado negro `[MEC 40]`, no baja a simple.
- Reforzado + GRS → se queda el reforzado blanco (no existe reforzado gris).
- Cortina **dúo** blanca + NEG → el chip dual cambia de color y **conserva el
  lado**.
- MET → el kit se queda como está (no hay kit metálico de bodega).

También funciona desde Fase 1: cambia el color de la fila, guarda, y al reabrir
en Fase 2 el kit ya está en el color nuevo.

---

## 7. Colores de accesorios nuevos

**Qué tocar** — *Colores de accesorios* → Agregar color. Código `DOR`, nombre
`DORADO`, uso «Accesorios». En el paso de mecanismos, crea el kit «KIT SIMPLE
DORADO 38MM» con un número MEC libre. En el paso de códigos, completa solo las
tapas de peso y deja el resto vacío a propósito.

**Qué debe pasar**

1. El paso final resume dónde quedó conectado y **qué quedó sin código**.
2. En el banco, elige color DOR: el kit dorado sale solo, las tapas salen con tu
   código, y los avisos nombran lo que dejaste vacío.
3. Las piezas sin código **igual aparecen** en la lista, con su descripción. Eso
   es lo correcto: antes desaparecían en silencio junto con los tornillos.
4. En Fase 2, el botón **DOR** aparece en Color accesorios.

**Prueba extra** — Si el inventario tiene una cadena de ese color, el banco la
auto-selecciona; si no, avisa que la elige el vendedor.

**Volver atrás** — Quitar el color. Las OTs que ya lo tengan lo conservan.

---

## 8. La pasada completa (una vez, al final)

Cuando las secciones de arriba estén bien, vale la pena una OT de prueba real:

1. **Fase 1** — Crea una OT «PRUEBA», con una ventana de cada tipo que te
   interese (una roller, una de oscuridad, y el tipo propio si creaste uno).
   Verifica que el precio salga del producto y que el COD SEC sea el esperado.
2. **Fase 2** — Abre cada ventana: kit, tubo, cadena y peso deben coincidir con
   lo que mostró el banco. Cambia el color y confirma que kit y cadena se mueven
   juntos.
3. **Fase 4** — Genera y revisa:
   - **Excel de órdenes**: las columnas del molde, con el COD SEC correcto.
   - **Cálculo General**: cada cortina en su bloque.
   - **Etiquetas Brother**: los códigos de las piezas.
   - **Inventario**: kits, tapas, tornillos y cadenas de los colores usados.
4. **Borra la OT de prueba** al terminar.

---

## Si algo no calza

- **El banco muestra una cosa y Fase 2 otra** → es un bug real del motor, no de
  la vista previa. Anota la categoría, medidas y color exactos.
- **Una pieza sale sin código** → falta catalogar ese color en *Colores de
  accesorios* (o el insumo no existe en bodega).
- **El kit no es el que esperabas** → mira la línea «por qué» del banco: dice
  qué regla ganó. Las reglas por ancho mandan sobre las de categoría, y estas
  sobre el kit por color.
