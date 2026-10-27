# Lector PDF Minimalista — Manual de usuario

Guía de uso de Folio, el lector de PDF minimalista.

---

## 1) Primeros pasos

### Instalar la aplicación

La aplicación se llama **Folio**.

- **Windows**: ejecutar el instalador `Folio Setup <version>.exe` y seguir los
  pasos. El instalador permite elegir la carpeta de instalación y crea accesos
  directos en el escritorio y el menú de Inicio. En la última pantalla aparece
  la casilla **Set Folio as default PDF viewer**; si se marca, al cerrar el
  instalador se abre la configuración de aplicaciones predeterminadas de
  Windows, donde se elige Folio para los archivos `.pdf`.
- **Linux**: no necesita instalación. Se ejecuta directamente el archivo
  `Folio.AppImage`.

### Abrir Folio

- Desde el acceso directo del escritorio o del menú Inicio.
- Con doble click sobre un PDF, si Folio quedó como lector predeterminado.
- Con click derecho sobre un PDF → **Abrir con** → **Folio**. En este caso la
  aplicación arranca mostrando directamente ese documento.

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
| Comments | Con un PDF abierto | Abre el panel de comentarios |
| Save As | Con un PDF abierto | Guarda una copia con otro nombre o ubicación |
| Save | Con un PDF abierto | Sobrescribe el archivo original |
| Append File | Con un PDF abierto | Concatena otro PDF al final del actual |
| Insert Signature Image | Con un PDF abierto | Coloca la imagen de una firma en la página |
| Sign Document | Con un PDF abierto | Firma digitalmente con la tarjeta de firma |
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
- **Desde el explorador de archivos**: doble click o **Abrir con** → **Folio**
  (sección 1).

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
  reordenan las páginas (sección 10). Desde esta pestaña se pueden eliminar páginas 
  (sección 9).
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

1. Abrir el panel lateral y quedarse en la pestaña **Pages**.
2. Presionar **Delete Pages**, arriba de las miniaturas. El botón cambia a
   **Cancel** y aparece **Save Changes**.
3. Pulsar la **x** de cada página que se quiera eliminar. La miniatura queda
   marcada como eliminada.
4. Presionar **Save Changes** para aplicar los cambios, o **Cancel** para
   descartarlos.

El documento siempre debe conservar al menos una página: la **x** de la última
página que queda no hace nada.

El cambio ocurre solo en el documento abierto; el archivo en disco no se
modifica hasta guardarlo (sección 12).

---

## 10) Reordenar páginas

Permite mover una página a otra posición dentro del documento, arrastrando su
miniatura.

1. Abrir el panel lateral y quedarse en la pestaña **Pages**.
2. Presionar **Edit File**, arriba de las miniaturas. El botón cambia a
   **Cancel** y aparece **Save Changes**.
3. Arrastrar una miniatura. Una línea horizontal indica dónde va a quedar la
   página al soltarla. Si se arrastra cerca del borde superior o inferior, el
   panel hace scroll para mostrar más páginas.
4. Repetir con todas las páginas que haga falta mover.
5. Presionar **Save Changes**.

El documento se recarga con el nuevo orden.

Cosas que conviene saber:

- Mientras se reordena, el número debajo de cada miniatura **no se renumera**:
  sigue mostrando la página original. Por eso la lista se ve con los números
  desordenados hasta guardar. Es normal.
- Mientras el modo está activo, hacer click en una miniatura ya no salta a esa
  página. Para volver a navegar, presionar **Cancel** o **Save Changes**.
- Eliminar y reordenar se hacen por separado: primero una operación con su
  **Save Changes**, luego la otra.
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

Todo lo que se hace sobre el documento (resaltados, comentarios, imagen de
firma, firma digital, eliminar, reordenar o concatenar páginas) vive solo en
memoria hasta guardar. Si se cierra la aplicación sin guardar, se pierde.

---

## 13) Resaltar texto

### Crear un resaltado

1. Seleccionar texto con el mouse.
2. Al soltar el click aparece, justo debajo de la selección, una pequeña barra
   con dos botones:
   - **Highlight** (ícono de marcador): resalta el texto.
   - **Add comment** (ícono de globo de texto): abre el panel de comentarios
     para comentar ese texto (sección 14).
3. Pulsar **Highlight**. El texto queda resaltado en verde.

Una selección que abarca varias páginas se resalta en todas ellas. La barra
desaparece sola al deseleccionar el texto.

### Cambiar el color o borrar un resaltado

Un click sobre un texto resaltado abre, junto al cursor, una pequeña paleta con:

- **Cuatro colores**: rojo, azul, amarillo y verde. El color actual aparece
  marcado. Un click en otro color lo cambia.
- **Add comment** (ícono de globo de texto): agrega un comentario a ese texto
  (sección 14).
- **Delete highlight** (ícono de papelera): elimina el resaltado.

La paleta se cierra con un click fuera de ella, con `Escape` o al hacer scroll.

Los resaltados que el PDF ya traía de otros programas también se pueden
recolorear o borrar. Como todo cambio, quedan en el archivo solo después de
guardar (sección 12).

---

## 14) Comentarios

Los comentarios son notas asociadas a un fragmento del texto o a una página.
Quedan guardados dentro del propio PDF, así que otros lectores de PDF también
los muestran.

### Agregar un comentario

Hay tres formas:

- **Sobre texto seleccionado**: seleccionar el texto y pulsar **Add comment**
  en la barra que aparece debajo de la selección.
- **Sobre un texto ya resaltado**: hacer click sobre el resaltado y pulsar
  **Add comment** en la paleta que aparece (sección 13). El resaltado pasa a
  ser el del comentario y queda con el botón **`⋯`** a su lado.
- **Sin texto asociado**: **Comments** en el menú contextual. El comentario se
  asocia a la página sobre la que se hizo click derecho, o a la página actual
  si se abrió con la tecla `M`.

En los tres casos se abre el panel **Comments** a la derecha. Si había texto
seleccionado, aparece citado arriba del cuadro de escritura. Escribir la nota y
presionar **Comment**.

### El panel de comentarios

Muestra todos los comentarios del documento, incluidos los que ya traía el PDF.
El encabezado indica cuántos hay. Cada tarjeta muestra el texto citado (si lo
hay), la nota y la página.

Un click sobre una tarjeta lleva al lugar del comentario y lo marca en amarillo
por un par de segundos. El botón `×` cierra el panel.

### Ver, editar y borrar un comentario

En el documento, cada texto comentado tiene un pequeño botón **`⋯`** a su
derecha.

- **Pasar el mouse** sobre el botón muestra la nota y su autor.
- **Hacer click** abre una ventana con la fecha de creación y de última
  modificación y dos botones:
  - **Edit comment** (ícono de lápiz): permite cambiar el texto. **Accept** (o
    `Ctrl` + `Enter`) guarda el cambio y **Cancel** (o `Escape`) lo descarta.
  - **Delete comment** (ícono de papelera): elimina el comentario.

La ventana se puede mover arrastrándola desde la parte de las fechas, y se
cierra con un click fuera de ella o con `Escape`.

Para que los comentarios queden en el archivo hay que guardar el documento
(sección 12); el propio panel lo recuerda con el aviso *Save the PDF to keep
comments in the file*.

---

## 15) Insertar una imagen de firma

Coloca una imagen (por ejemplo, una firma escaneada) sobre una página del
documento. Es solo una imagen: no tiene validez como firma digital. Para eso
está la sección 16.

1. Ir a la página donde va la firma.
2. **Insert Signature Image** en el menú contextual.
3. Elegir una imagen **PNG** o **JPG**.
4. La imagen aparece en la parte inferior de la página, con una barra debajo:
   - **Arrastrarla** para moverla.
   - **Tirar de la esquina inferior derecha** para cambiar el tamaño. La imagen
     conserva sus proporciones.
5. Presionar **Insert** para colocarla, o **Cancel** (o `Escape`) para
   descartarla.

Al insertarla, el documento se recarga con la imagen ya fija en la página. Para
conservarla hay que guardar (sección 12).

Si la imagen no se puede usar, aparece un aviso en la esquina inferior derecha,
por ejemplo *That file is not a valid PNG or JPG image*.

---

## 16) Firma digital

### Firmar un documento

Firma el documento con la **tarjeta de firma digital de Costa Rica**. La firma
no se ve en la página, pero queda dentro del PDF y garantiza quién lo firmó y
que no fue modificado después.

Se necesita:

- La tarjeta de firma digital y un lector de tarjetas conectado.
- El controlador oficial de la tarjeta instalado en la computadora.
- El PIN de la tarjeta.

Pasos:

1. Insertar la tarjeta en el lector.
2. **Sign Document** en el menú contextual.
3. Escribir el PIN y presionar **Sign** (o **Enter**).
4. Esperar mientras aparece el mensaje *Signing with the card. Do not remove it
   from the reader.* No retirar la tarjeta.
5. Al terminar aparece *Document signed by &lt;nombre&gt;. Save it to keep the
   signature.* Presionar **Accept**.
6. Guardar el documento (sección 12). Si no se guarda, la firma se pierde.

**Cancel**, `Escape` o un click fuera de la ventana cierran el diálogo sin
firmar.

### Orden recomendado

La firma protege el documento tal como estaba al firmar. **Cualquier cambio
posterior** (resaltar, comentar, insertar una imagen, eliminar o reordenar
páginas, concatenar) hace que la firma aparezca como no válida. Por eso:

1. Hacer primero todos los cambios, incluida la imagen de firma si se quiere
   una firma visible.
2. Firmar al final.
3. Guardar.

### Mensajes de error

| Mensaje | Qué hacer |
| --- | --- |
| *Enter the PIN of your signature card.* | Escribir el PIN antes de pulsar **Sign** |
| *Incorrect PIN. Check it before trying again.* | Revisar el PIN. Varios intentos fallidos bloquean la tarjeta |
| *The card is blocked. Unlock it with the PIN tool.* | Desbloquear la tarjeta con la herramienta de PIN del controlador |
| *The digital signature driver is not installed.* | Instalar el controlador de la tarjeta |
| *No card detected. Insert it in the reader and try again.* | Revisar que la tarjeta y el lector estén bien conectados |
| *The card could not be read. Try reconnecting the reader.* | Desconectar y volver a conectar el lector |
| *No certificate was found on the card.* | La tarjeta no tiene un certificado de firma utilizable |

Después de un error, **Try again** vuelve a pedir el PIN.

### Verificar un documento firmado

Al abrir un PDF que tiene firmas digitales, aparece una etiqueta en la esquina
superior derecha, junto al pin del modo flotante:

| Etiqueta | Significado |
| --- | --- |
| Verde: *Signed by &lt;nombre&gt;* | Firmado por una persona; la firma es válida y el documento no cambió |
| Verde: *Signed by N people* | Varias firmas, todas válidas |
| Rojo: *Signature not valid* | Alguna firma no corresponde al contenido, o el documento se modificó después de firmarse |

Pasar el mouse sobre la etiqueta muestra el detalle de cada firma: nombre del
firmante, fecha y hora, y el problema si lo hay.

Si el documento no tiene firmas, no aparece ninguna etiqueta.

---

## 17) Resumen de atajos

| Atajo | Acción |
| --- | --- |
| Click derecho o `M` | Abrir el menú de acciones |
| `J` / `K` | Página siguiente / anterior |
| `Ctrl` + `F` | Abrir la búsqueda |
| `Enter` / `Shift` + `Enter` | Coincidencia siguiente / anterior |
| `Escape` | Cerrar la búsqueda, la paleta de resaltado, la ventana de un comentario o el diálogo de firma; cancelar la imagen de firma; salir del modo presentación |
| `Ctrl` + `Enter` | Aceptar la edición de un comentario |
| `Ctrl` + `+` / `Ctrl` + `-` | Acercar / alejar |
| `Ctrl` + rueda | Zoom sobre el cursor |
| `Ctrl` + `V` | Abrir un PDF copiado, o concatenarlo si ya hay uno abierto |
| `C` | Copiar el texto seleccionado |
| `→` / `←` | Cambiar de página en modo presentación |

---

## 18) Problemas frecuentes

**Pasan cosas raras mientras escribo.** Los atajos de una sola tecla (`M`, `J`,
`K`, `C`) funcionan en cualquier momento, incluso escribiendo en el campo de
búsqueda, en el contador de páginas, o en un comentario. Buscar una palabra con 
`j` o `k`, por ejemplo, también cambia de página, y una `m` abre el menú. Si el 
menú queda abierto, cerrarlo con `Escape` o con un click fuera.

**Solté un PDF y en vez de abrirlo lo pegó al final del otro.** Es el
comportamiento actual: soltar o pegar con un documento abierto concatena. Para
reemplazar, usar **Open New File**.

**Save no hace nada.** Ocurre cuando el documento no viene de un archivo en
disco, es decir después de concatenar. Usar **Save As**.

**Los números de las miniaturas quedaron desordenados.** Pasa mientras se
reordena y es esperado: las etiquetas conservan la página original hasta que se
presiona **Save Changes**.

**Arrastré una miniatura y se ve en blanco.** Las miniaturas se generan conforme
entran en pantalla. Si se arrastra una que aún no se ha dibujado, se ve vacía,
pero la página se mueve igual.

**La pestaña Outline está vacía.** El PDF no trae índice incorporado. Es común
en documentos escaneados o exportados desde procesadores de texto sin estilos de
título.

