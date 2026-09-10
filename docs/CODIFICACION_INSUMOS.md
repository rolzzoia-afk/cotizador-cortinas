# Codificación de insumos

Cómo se numera un artículo del inventario, por qué el código no se cambia nunca
y qué hacer cuando uno queda mal puesto.

---

## 1. El código es una llave, no una descripción

`insumos.cod` es `MEC32`. Está escrito en 14 columnas de texto de la base, en 7
claves JSON de `configuracion`, en el optimizador antiguo, en los QR pegados en
el galpón y en los Excel de las vendedoras. **No cambia nunca.**

Eso quiere decir que un código no tiene por qué *explicar* el artículo. `MEC32`
no dice de qué color es ni para qué cortina sirve, y está bien: para eso están
el nemotécnico, la categoría y el color. El código solo tiene que ser único y
estable.

Del método SAP se copió esa disciplina —el número lo asigna el sistema desde un
rango por tipo de material, nunca cambia, y el significado vive en los datos
maestros— y **no** sus números sin significado, porque acá el taller lee
estantes y etiquetas.

## 2. La forma

```
1 a 4 letras · 2 o 3 dígitos · opcionalmente un sufijo de 1 o 2 caracteres
```

En la base es el CHECK `insumos_cod_forma`, y en el código la constante
`RE_CODIGO_INSUMO` de `src/modules/inventario/codigosInsumo.ts`. **Si una
cambia, la otra también**: el formulario y la base tienen que rechazar lo mismo.

| Acepta | Rechaza | Por qué |
|---|---|---|
| `MEC46` · `INS265` · `E80` | `E1` | Menos de 2 dígitos |
| `MEC44-B` · `E69-B` | `INS-1234` | El guion no separa el número |
| `INS20-1` | `CAD 13` · `DOM 18` | Con espacio son dos códigos distintos |
| `LAMP01` · `WALL01` · `UTEN07` | `0` | Sin letras no es un código |

## 3. Las familias

Cada prefijo es una **familia**, y cada familia lleva su propio correlativo en
la tabla `familias_insumo`. Se administran en **Inventario → Configuración →
Familias de código**.

| Prefijo | Qué es | Dígitos |
|---|---|---|
| `INS` | Insumos generales: felpas, papelería, químicos, eléctrico | 3 |
| `HER` | Herramientas | 3 |
| `TOR` | Tornillería | 3 |
| `E` | Estructuras: tubos, pesos, cenefas, perfiles, ángulos | 2 |
| `VER` | Piezas de cortina vertical | 2 |
| `UNI` | Uniformes **y** uniones (dos significados, ver abajo) | 2 |
| `DOM` | Domótica: motores, hubs, controles | 2 |
| `MEC` | Mecanismos | 2 |
| `SML` | Beeblack (rieles, esquineros, cabezales) | 2 |
| `TAP` | Tapas laterales | 2 |
| `CAD` | Cadenas | 2 |
| `LAMP` | Lámparas | 2 |
| `EPP` | Elementos de protección personal | 2 |
| `INM` | Motores inalámbricos **y** botas de seguridad | 3 |
| `PCA` | Pesos porta cadena | 2 |
| `ZUN` | Zunchos | 2 |
| `TAR` | Tarugos | 2 |
| `TOP` | Topes | 2 |
| `MOT` | Motores de vertical | 2 |
| `BRA` | Brackets | 2 |
| `CIN` | Cintas | 2 |
| `MIC` | Micas | 2 |
| `TIR` | Tirro | 2 |
| `SEC` | Seguros de niños | 2 |
| `SUB` | Suplementos | 2 |
| `GOM` | Goma esponja | 2 |
| `FOC` | Focos y paneles LED | 2 |
| `WALL` | Wall panel | 2 |
| `BK`, `DU`, `SC` | Muestrarios de blackout, dúo y screen | 2 |
| `UTEN`, `VAS`, `ESTU`, `GEN`, `CAR` | Cubertería, vasos, estufa, generadores, carro | 2 |
| `SLM` | **Desactivada**: es `SML` escrito al revés | 2 |

**Dos familias significan dos cosas distintas.** `UNI` es *uniforme* (46
artículos) y *unión* (6); `INM` es *inalámbrico* (motores) y también botas de
seguridad, y por eso salta de INM12 a INM179. No se arreglan renombrando: los
códigos ya emitidos se quedan como están y lo nuevo entra en la familia
correcta.

**Los dígitos son 2 salvo que la familia haya pasado de 99.** INS, HER, TOR e
INM usan 3. Es solo el relleno de los códigos NUEVOS: `INS99` e `INS100`
conviven sin problema, y la app los ordena por número, no por texto.

**Los huecos no se reutilizan.** Si falta `INS42`, es porque ese código se borró
y puede seguir vivo en una etiqueta pegada o en el historial de una OT. La base
salta los ocupados hacia adelante y nunca retrocede.

## 4. Los sufijos

| Sufijo | Significa | Estado |
|---|---|---|
| `-B` | Categoría B, la gama económica: `MEC44-B`, `E69-B`, `TAP28-B` | **Vigente** |
| `-1` | Variante o unidad dañada: `DOM01-1`, `INS20-1` | **Congelado** |

`-1` se congeló porque significaba dos cosas incompatibles: «esta unidad está
dañada», que es un **estado** y vive en el kardex, y «la otra mitad del par»,
que es **otro artículo** y merece su propio correlativo. Los que ya existen se
dejan como están.

**El color nunca va en la llave.** Va en el código visible.

## 5. El código visible

Lo que se lee y se imprime es `MEC32-BCO`: la llave más las tres letras del
color. **Se calcula, no se guarda** (`codigoVisible(cod, color)`).

Así el taller distingue de un vistazo las tres cadenas de 3 metros —`CAD01-GRS`,
`CAD04-NEG`, `CAD06-BCO`— sin tener que saberse los números de memoria. Hay 69
grupos de «mismo artículo, distinto color» en el catálogo: 170 códigos, el 17 %.

| Color en la ficha | Sufijo |
|---|---|
| BLANCO / BLANCA | `-BCO` |
| NEGRO / NEGRA | `-NEG` |
| GRIS | `-GRS` |
| METAL / METÁLICO | `-MET` |
| ALUMINIO | `-ALU` |
| CAFÉ / MADERA | `-CAFE` |
| TRANSPARENTE | `-TRA` |

**Un color que no está en esa tabla NO inventa sufijo.** Un artículo azul o
beige se ve como `TIR02`, sin color: un `-AZ` que nadie definió se leería como
otro código. La pantalla de Configuración lista los colores que quedaron sin
abreviatura para que alguien decida si vale la pena agregarlos.

El color sale de la columna `insumos.color`. Si está mal, el sufijo impreso está
mal: es la única parte del código visible que depende de que alguien haya
llenado bien la ficha.

**El QR no cambia.** El payload sigue siendo `INS:<cod>` con la llave pelada,
para que las etiquetas ya pegadas en el galpón sigan escaneando. Lo que cambia
es el texto impreso al lado.

### Dónde se ve

| Sí | No, y por qué |
|---|---|
| Catálogo de insumos, ficha y alertas | Chips del cotizador (`[MEC 18]`): otra grafía |
| Kardex (tabla y CSV, en su propia columna) | Recetas de precios (`'MEC 18'`): movería la paridad |
| Hoja de inventario de la OT (PDF) | `codInt` del catálogo (`'DOM 47'`): es otra llave |
| Hoja de bodega y vista de costo | Optimizador antiguo: no se toca |
| Etiqueta impresa del insumo | Payload del QR: las etiquetas viejas dejarían de leerse |
| «Lo que no se mueve», en Reportes | Etiquetas Brother: campos medidos en mm sobre el `.lbx`; hay que verificar que `-CAFE` no se salga antes de tocarlas |

En las exportaciones el visible va en una **columna aparte** y nunca pisa la
llave: `cod` es con lo que la planilla se vuelve a importar y se cruza contra
cualquier otra.

## 6. Cómo se da de alta un artículo

1. Se elige la **familia** en el desplegable.
2. Aparece el código propuesto, de solo lectura, con la leyenda «se confirma al
   guardar».
3. Al guardar, la base bloquea la fila de la familia, busca el primer número
   libre, lo asigna e inserta el artículo **en la misma transacción**.

Por eso la propuesta puede no ser el código final: si alguien guarda en el
segundo intermedio se lleva ese número y al siguiente le toca el que sigue. El
mensaje de confirmación dice con qué código quedó.

**Código a mano**: solo un administrador, para lo que trae código de fábrica o
de una serie externa. Se valida la forma y se avisa si ya existe. El correlativo
de la familia **no** se mueve: dar de alta un `MEC90` a mano no debe quemar los
42 números del medio, y el bucle que salta los ocupados ya evita el choque.

**Toda alta pasa por `insumo_crear`.** Una alta escrita a mano en un SQL elige
el número a ojo y es exactamente como se llegó al desorden. Si hay que hacerlo
igual, el CHECK rechaza la forma inválida y el UNIQUE el duplicado, pero el
correlativo queda desalineado hasta que alguien lo corrija en Configuración.

## 7. Un código mal puesto

**Nunca se renombra el catálogo.** El método es el del renombre `E78 → E39`
(`sql/20260814_e78_a_e39.sql`, 259 líneas para UN código):

1. Dar de alta el código nuevo.
2. Marcar el viejo `status = 'AGOTADO'` y `estado_inventario = 'DESCONTINUADO'`,
   con un comentario que diga a qué código apunta.
3. Nunca `DELETE`.

Si de verdad hay que corregir la grafía —el caso de `DOM 18 → DOM18` del
`sql/20260910_insumos_01_familias.sql`—, se arrastra con respaldo previo y
aserción sobre las 6 tablas satélite más `ots.items` y `configuracion`.

> **Trampa de Postgres**: `\b` es el carácter BACKSPACE, **no** el límite de
> palabra. El límite es `\y`. Un `UPDATE ... WHERE col ~ '\bDOM 18\b'` «tiene
> éxito» sin tocar una sola fila.

## 8. Las tres grafías que conviven

El sistema escribe el mismo objeto de tres maneras según quién lo mire, y las
tres son correctas en su lugar:

| Grafía | Dónde | Ejemplo |
|---|---|---|
| `MEC18` | `insumos.cod`, kardex, colmena, QR | sin espacios |
| `'MEC 18'` | recetas de precios, chips del cotizador | con espacio |
| `'DOM 47'` | `codInt` del catálogo de productos | con espacio |

No se unifican: renombrar las recetas movería la paridad de precios con el Excel
de las vendedoras, y el `codInt` es la llave con la que el cotizador arma el
producto. Lo que sí es único es el **normalizador**: `normalizarCodigoInsumo`
(mayúsculas, sin espacios, conserva el guion) lo usan el catálogo, la colmena y
la bodega.

La única excepción deliberada es `InsumosPreciosSection`, que además come puntos
y guiones para colapsar `MEC44-B` con `MEC44B`. Está anotado en el código: si
alguna vez se endurece, hay que comparar una cotización de referencia antes y
después.

---

## Dónde vive cada cosa

| | |
|---|---|
| Forma, familia, color visible, orden | `src/modules/inventario/codigosInsumo.ts` |
| Listas del formulario y avisos de familia | `src/modules/inventario/validadores.ts` |
| Tabla `familias_insumo`, CHECK y RPCs | `sql/20260910_insumos_01_familias.sql` |
| Reclasificación por datos | `sql/20260910_insumos_02_reclasificacion.sql` |
| Pantalla | Inventario → Configuración |
