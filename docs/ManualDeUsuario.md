# Lector PDF Minimalista — Manual de usuario

Guía de uso de Folio, el lector de PDF minimalista.

---

## 1) Primeros pasos

### Ejecutar la aplicación

La aplicación se llama **Folio** y no necesita instalación: se ejecuta el
archivo directamente.

- **Windows**: doble click sobre `Folio.exe`.

### La ventana

La ventana usa el marco del sistema operativo, con sus botones de minimizar,
maximizar y cerrar. La aplicación no tiene barra de menús propia; todas las
acciones sobre el documento están en el menú contextual.

### El menú contextual

Es el centro de la aplicación. Se abre con **click derecho** en cualquier parte
de la ventana, o presionando la tecla **`M`**. Sus opciones cambian según haya o
no un PDF abierto.

| Opción | Disponible | Qué hace |
| --- | --- | --- |
| Open New File | Siempre | Abre el selector de archivos |
| Save As | Con un PDF abierto | Guarda una copia con otro nombre o ubicación |
| Save | Con un PDF abierto | Sobrescribe el archivo original |
| Delete Pages | Con un PDF abierto | Abre el diálogo para eliminar páginas |
| Append File | Con un PDF abierto | Concatena otro PDF al final del actual |
| Merge Files | Con un PDF abierto | Aún no implementada |
| Open in Presentation Mode | Con un PDF abierto | Abre el modo presentación |
| Close Application | Siempre | Cierra la aplicación |

---

## 2) Abrir un documento

Hay varias formas de abrir un PDF:

- **Pantalla de bienvenida**: el botón **Open PDF Document...** en el centro.
- **Menú contextual**: la opción **Open New File**, en cualquier momento.
- **Arrastrar y soltar**: soltar un archivo PDF sobre la ventana. Mientras se
  arrastra, la ventana muestra un borde punteado indicando que se puede soltar.
- **Pegar**: copiar un archivo PDF en el explorador de archivos y presionar
  `Ctrl` + `V` sobre la ventana.

Cuidado con una diferencia importante: **si ya hay un documento abierto, soltar
o pegar otro PDF no lo reemplaza, lo concatena al final** (ver sección 11). Para
reemplazarlo hay que usar **Open New File**.

Solo se trabaja con un documento a la vez. Al abrir uno nuevo, la aplicación se
recarga y muestra el PDF.

---

## 3) Leer y navegar

### Desplazamiento

El documento se lee con scroll vertical continuo, todas las páginas una debajo
de la otra. Las páginas se cargan y se descartan conforme se avanza, así que
los documentos grandes no consumen memoria de más.

### Contador de páginas

En la parte superior central se muestra la página actual y el total, por
ejemplo `3 / 48`. Se actualiza solo al hacer scroll.

Para saltar a una página: click sobre el número, escribir la página destino y
presionar **Enter**.

### Avanzar y retroceder de página

Las teclas **`J`** y **`K`** mueven el documento una página completa: `J` a la
siguiente, `K` a la anterior. A diferencia del scroll, saltan al inicio de la
página, así que sirven para recorrer el documento página por página sin usar el
mouse. En la primera y la última página no hacen nada.

### Panel lateral

El botón de hamburguesa en la esquina superior izquierda abre y cierra el panel
lateral. Un segundo click sobre el mismo botón lo cierra. El panel tiene dos
pestañas:

- **Pages**: miniaturas de todas las páginas. La página en la que se está
  leyendo queda marcada y el panel la sigue automáticamente durante el scroll.
  Un click sobre una miniatura salta a esa página. Desde aquí también se
  reordenan las páginas (sección 10).
- **Outline**: el índice o tabla de contenidos que trae el PDF. Las secciones
  con subsecciones muestran una flecha para plegarlas y desplegarlas. Un click
  sobre una entrada salta a la posición exacta de esa sección, no solo al
  inicio de la página.

No todos los PDF traen índice. Si el documento no lo tiene, la pestaña muestra
el mensaje *This document has no outline*.

---

## 4) Zoom

| Acción | Atajo |
| --- | --- |
| Acercar | `Ctrl` + `+` |
| Alejar | `Ctrl` + `-` |
| Acercar o alejar sobre un punto | `Ctrl` + rueda del mouse |

El zoom va de 50% a 300%, en pasos de 15%. Con `Ctrl` + rueda, el punto bajo el
cursor se mantiene en su lugar, lo que sirve para revisar detalles sin perder la
referencia.

---

## 5) Buscar texto

`Ctrl` + `F` abre la barra de búsqueda en la esquina superior derecha.

- Escribir el término busca en todo el documento mientras se escribe.
- El contador muestra la coincidencia actual y el total, por ejemplo `4/17`.
- **Enter** o la flecha `↓` van a la siguiente coincidencia;
  `Shift` + **Enter** o la flecha `↑` a la anterior.
- La coincidencia activa se resalta y el documento se desplaza hasta ella.
- **Escape** o el botón `×` cierran la barra y limpian los resaltados.

---

## 6) Modo flotante

El botón con forma de pin, en la esquina superior derecha, mantiene la ventana
siempre visible por encima de las demás aplicaciones. Aparece solo cuando hay un
documento abierto.

Al activarlo, la ventana se reduce al ancho de la página, el zoom vuelve a 100%
y el panel lateral se cierra si estaba abierto. El pin se pone verde mientras el
modo está activo. Un segundo click devuelve la ventana a su comportamiento
normal.

Sirve para leer un documento mientras se trabaja en otra aplicación.

---

## 7) Modo presentación

**Open in Presentation Mode** en el menú contextual abre el documento en una
ventana aparte, a pantalla completa y con una página a la vez. Arranca en la
página que se estaba leyendo.

| Acción | Control |
| --- | --- |
| Página siguiente | Flecha `→` o rueda hacia abajo |
| Página anterior | Flecha `←` o rueda hacia arriba |
| Salir | `Escape` |

El cursor se oculta solo después de unos segundos sin movimiento.

---

## 8) Copiar texto

El texto del PDF es seleccionable con el mouse. Con texto seleccionado, la
tecla `C` lo copia al portapapeles.

---

## 9) Eliminar páginas

1. Click derecho y elegir **Delete Pages**.
2. Escribir los números de las páginas a eliminar separados por coma, por
   ejemplo `2,5,9`.
3. Presionar **Accept**.

El documento se recarga sin esas páginas. **Escape**, el botón **Cancel** o un
click fuera del diálogo lo cierran sin cambios.

El cambio ocurre solo en el documento abierto; el archivo en disco no se
modifica hasta guardarlo (sección 12).

---

## 10) Reordenar páginas

Permite mover una página a otra posición dentro del documento, arrastrando su
miniatura.

1. Abrir el panel lateral y quedarse en la pestaña **Pages**.
2. Presionar **Reordenar páginas**, arriba de las miniaturas. El botón cambia a
   **Terminar reordenamiento** y aparece **Guardar orden**.
3. Arrastrar una miniatura y soltarla sobre otra. Si se suelta en la mitad
   superior de la miniatura destino, la página queda antes de ella; en la mitad
   inferior, después.
4. Repetir con todas las páginas que haga falta mover.
5. Presionar **Guardar orden**.

El documento se recarga con el nuevo orden.

Tres cosas que conviene saber:

- Mientras se reordena, el número debajo de cada miniatura **no se renumera**:
  sigue mostrando la página original. Por eso la lista se ve con los números
  desordenados hasta guardar. Es normal.
- Mientras el modo está activo, hacer click en una miniatura ya no salta a esa
  página. Para volver a navegar, presionar **Terminar reordenamiento**.
- El cambio ocurre solo en el documento abierto; el archivo en disco no se
  modifica hasta guardarlo (sección 12).

---

## 11) Concatenar otro PDF

Añade un segundo documento completo al final del actual, conservando el orden de
sus páginas. Requiere tener ya un PDF abierto. Tres formas de hacerlo:

- **Append File** en el menú contextual, que abre el selector de archivos.
- Arrastrar y soltar el otro PDF sobre la ventana.
- Copiar el archivo y pegarlo con `Ctrl` + `V`.

Las tres hacen exactamente lo mismo. Después de concatenar, la aplicación se
recarga y muestra el documento combinado.

El resultado existe solo en memoria y **ya no está asociado a ningún archivo en
disco**, porque no corresponde a ninguno de los dos originales. Eso tiene una
consecuencia práctica: **Save** deja de funcionar y hay que usar **Save As**
(sección 12).

Si hay que concatenar varios documentos, se repite la operación: cada nuevo PDF
se agrega al final del resultado anterior.

La opción **Merge Files** del menú contextual es otra cosa y todavía no está
implementada.

---

## 12) Guardar

Ambas opciones están en el menú contextual.

- **Save** sobrescribe el archivo original en su ubicación actual. Al terminar
  aparece por unos segundos el mensaje *PDF saved successfully* en la esquina
  inferior derecha.
- **Save As** abre el diálogo del sistema para elegir nombre y carpeta, y deja
  el archivo original intacto.

Después de concatenar, **Save** no hace nada, porque el documento ya no viene de
un archivo en disco. Hay que usar **Save As**, que propone el nombre
`documento-combinado.pdf`.

En general, conviene usar **Save As** después de eliminar, reordenar o
concatenar páginas, hasta estar seguro del resultado.

---

## 13) Resumen de atajos

| Atajo | Acción |
| --- | --- |
| Click derecho o `M` | Abrir el menú de acciones |
| `J` / `K` | Página siguiente / anterior |
| `Ctrl` + `F` | Abrir la búsqueda |
| `Enter` / `Shift` + `Enter` | Coincidencia siguiente / anterior |
| `Escape` | Cerrar la búsqueda, el diálogo de páginas o el modo presentación |
| `Ctrl` + `+` / `Ctrl` + `-` | Acercar / alejar |
| `Ctrl` + rueda | Zoom sobre el cursor |
| `Ctrl` + `V` | Abrir un PDF copiado, o concatenarlo si ya hay uno abierto |
| `C` | Copiar el texto seleccionado |
| `→` / `←` | Cambiar de página en modo presentación |

---

## 14) Problemas frecuentes

**Pasan cosas raras mientras escribo.** Los atajos de una sola tecla (`M`, `J`,
`K`, `C`) funcionan en cualquier momento, incluso escribiendo en el campo de
búsqueda o en el contador de páginas. Buscar una palabra con `j` o `k`, por
ejemplo, también cambia de página, y una `m` abre el menú. Si el menú queda
abierto, cerrarlo con `Escape` o con un click fuera.

**Solté un PDF y en vez de abrirlo lo pegó al final del otro.** Es el
comportamiento actual: soltar o pegar con un documento abierto concatena. Para
reemplazar, usar **Open New File**.

**Save no hace nada.** Ocurre cuando el documento no viene de un archivo en
disco, es decir después de concatenar. Usar **Save As**.

**Los números de las miniaturas quedaron desordenados.** Pasa mientras se
reordena y es esperado: las etiquetas conservan la página original hasta que se
presiona **Guardar orden**.

**Arrastré una miniatura y se ve en blanco.** Las miniaturas se generan conforme
entran en pantalla. Si se arrastra una que aún no se ha dibujado, se ve vacía,
pero la página se mueve igual.

**La pestaña Outline está vacía.** El PDF no trae índice incorporado. Es común
en documentos escaneados o exportados desde procesadores de texto sin estilos de
título.

**Merge Files no hace nada.** Todavía no está implementada. Para unir documentos
usar **Append File** (sección 11).