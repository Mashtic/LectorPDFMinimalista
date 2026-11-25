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
- Con click derecho sobre un archivo `.pdf`, `.dvi` o `.epub` → **Abrir con** →
  **Folio**. En este caso la aplicación arranca mostrando directamente ese
  documento.

### La ventana

La ventana usa el marco del sistema operativo, con sus botones de minimizar,
maximizar y cerrar. La aplicación no tiene barra de menús propia; todas las
acciones sobre el documento están en el menú contextual.

### El menú contextual

Es el centro de la aplicación. Se abre con **click derecho** en cualquier parte
de la ventana, o presionando la tecla **`M`**. Sus opciones cambian según haya o
no un documento abierto.

| Opción | Disponible | Qué hace |
| --- | --- | --- |
| Open New File | Siempre | Abre el selector de archivos |
| Comments | Con un documento abierto | Abre el panel de comentarios |
| Add Text Box | Con un documento abierto | Permite dibujar una caja de texto sobre la página |
| Save As | Con un documento abierto | Guarda una copia con otro nombre o ubicación |
| Save | Con un documento que viene de un PDF en disco | Sobrescribe el archivo original |
| Append File | Con un documento abierto | Concatena otro PDF al final del actual |
| Signature Appearance | Con un documento abierto | Configura cómo se ve la firma en la página |
| Sign Document | Con un documento abierto | Firma digitalmente con la tarjeta de firma |
| Open in Presentation Mode | Con un documento abierto | Abre el modo presentación |
| Close Application | Siempre | Cierra la aplicación |

---

## 2) Abrir un documento

### Tipos de archivo

Folio abre tres tipos de archivo:

- **PDF** (`.pdf`): se abre tal cual.
- **DVI** (`.dvi`): el formato que produce LaTeX. Folio lo convierte a PDF al
  abrirlo. Para eso la computadora necesita tener instalado **TeX Live** o
  **MiKTeX**, porque la conversión usa el programa `dvipdfmx` y las fuentes de
  TeX que vienen con ellos.
- **EPUB** (`.epub`): libros electrónicos. Folio los convierte a PDF al
  abrirlos, con un capítulo detrás de otro. El índice del libro y los enlaces
  entre capítulos siguen funcionando. Los libros protegidos con DRM no se pueden
  abrir.

Un DVI o EPUB convertido existe solo en memoria: no hay todavía un PDF en disco.
Por eso la opción **Save** no aparece y hay que usar **Save As**, que propone el
mismo nombre del archivo original con extensión `.pdf` (sección 11).

### Formas de abrir

- **Pantalla de bienvenida**: el botón **Open PDF Document...** en el centro.
- **Menú contextual**: la opción **Open New File**, en cualquier momento.
- **Arrastrar y soltar**: soltar un archivo PDF sobre la ventana. Mientras se
  arrastra, la ventana muestra un borde punteado indicando que se puede soltar.
- **Pegar**: copiar un archivo PDF en el explorador de archivos y presionar
  `Ctrl` + `V` sobre la ventana.
- **Desde el explorador de archivos**: doble click o **Abrir con** → **Folio**
  (sección 1).

Arrastrar y pegar funcionan solo con PDF. Los archivos DVI y EPUB se abren con
**Open New File** o desde el explorador de archivos.

Cuidado con una diferencia importante: **si ya hay un documento abierto, soltar
o pegar otro PDF no lo reemplaza, lo concatena al final** (ver sección 10). Para
reemplazarlo hay que usar **Open New File**.

Solo se trabaja con un documento a la vez. Al abrir uno nuevo, la aplicación se
recarga y muestra el documento. Si el actual tiene cambios sin guardar, antes
se pregunta qué hacer con ellos (sección 11).

### Mensajes de error al abrir

| Mensaje | Qué hacer |
| --- | --- |
| *Opening DVI files requires dvipdfmx. Install TeX Live or MiKTeX and try again.* | Instalar TeX Live o MiKTeX |
| *The DVI file could not be converted to PDF. Fonts or images it references may be missing.* | Revisar que las imágenes que usa el documento estén junto al `.dvi` |
| *The file is damaged or is not a valid EPUB book.* | El archivo está dañado o no es un EPUB |
| *This EPUB book is protected with DRM and cannot be opened.* | Folio no abre libros con DRM |

---

## 3) Leer y navegar

### Desplazamiento

El documento se lee con scroll vertical continuo, todas las páginas una debajo
de la otra. Las páginas se cargan y se descartan conforme se avanza, así que
los documentos grandes no consumen memoria de más. Si con el zoom la página
queda más ancha que la ventana, aparece también una barra de desplazamiento
horizontal.

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

### Enlaces

Los enlaces del documento se pueden pulsar:

- **Enlaces internos** (por ejemplo, las entradas de un índice o las referencias
  a otra sección): llevan a ese lugar del documento.
- **Enlaces a páginas web y correos**: se abren en el navegador o en el
  programa de correo predeterminado del sistema.

### Panel lateral

El botón de hamburguesa en la esquina superior izquierda abre y cierra el panel
lateral. Un segundo click sobre el mismo botón lo cierra. El panel tiene dos
pestañas:

- **Pages**: miniaturas de todas las páginas. La página en la que se está
  leyendo queda marcada y el panel la sigue automáticamente durante el scroll.
  Un click sobre una miniatura salta a esa página. Desde aquí también se
  eliminan y reordenan las páginas (sección 9).
- **Outline**: el índice o tabla de contenidos que trae el documento. Las
  secciones con subsecciones muestran una flecha para plegarlas y desplegarlas.
  Un click sobre una entrada salta a la posición exacta de esa sección, no solo
  al inicio de la página.

No todos los PDF traen índice. Si el documento no lo tiene, la pestaña muestra
el mensaje *This document has no outline.*

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

## 9) Editar páginas: eliminar y reordenar

Eliminar y reordenar páginas se hace desde un mismo modo de edición, en la
pestaña **Pages** del panel lateral. Ambas cosas se pueden combinar en una sola
pasada.

1. Abrir el panel lateral y quedarse en la pestaña **Pages**.
2. Presionar **Edit File**, arriba de las miniaturas. El botón cambia a
   **Cancel** y aparece **Accept**.
3. Para **eliminar** una página, pulsar la **×** de su miniatura. La miniatura
   queda marcada como eliminada.
4. Para **mover** una página, arrastrar su miniatura. Una línea horizontal
   indica dónde va a quedar al soltarla. Si se arrastra cerca del borde
   superior o inferior, el panel hace scroll para mostrar más páginas.
5. Presionar **Accept** para aplicar todos los cambios, o **Cancel** para
   descartarlos y volver al orden original.

El documento se recarga con las páginas eliminadas y el nuevo orden.

Cosas que conviene saber:

- El documento siempre debe conservar al menos una página: la **×** de la
  última página que queda no hace nada.
- Mientras se edita, el número debajo de cada miniatura **no se renumera**:
  sigue mostrando la página original. Por eso la lista se ve con los números
  desordenados hasta pulsar **Accept**. Es normal.
- Mientras el modo está activo, hacer click en una miniatura ya no salta a esa
  página. Para volver a navegar, presionar **Cancel** o **Accept**.
- El cambio ocurre solo en el documento abierto; el archivo en disco no se
  modifica hasta guardarlo (sección 11).

---

## 10) Concatenar otro PDF

Añade un segundo documento completo al final del actual, conservando el orden de
sus páginas. Requiere tener ya un documento abierto. Tres formas de hacerlo:

- **Append File** en el menú contextual, que abre el selector de archivos.
- Arrastrar y soltar el otro PDF sobre la ventana.
- Copiar el archivo y pegarlo con `Ctrl` + `V`.

Las tres hacen exactamente lo mismo. Después de concatenar, la aplicación se
recarga y muestra el documento combinado.

El resultado existe solo en memoria y **ya no está asociado a ningún archivo en
disco**, porque no corresponde a ninguno de los dos originales. Por eso la
opción **Save** desaparece del menú y hay que usar **Save As** (sección 11).

Si hay que concatenar varios documentos, se repite la operación: cada nuevo PDF
se agrega al final del resultado anterior.

---

## 11) Guardar

Ambas opciones están en el menú contextual.

- **Save** sobrescribe el archivo original en su ubicación actual. Al terminar
  aparece por unos segundos el mensaje *PDF saved successfully* en la esquina
  inferior derecha. Solo aparece en el menú cuando el documento viene de un PDF
  en disco.
- **Save As** abre el diálogo del sistema para elegir nombre y carpeta, y deja
  el archivo original intacto.

**Save** no aparece cuando el documento no tiene un PDF en disco detrás:

- Después de concatenar: **Save As** propone el nombre `documento-combinado.pdf`.
- Al abrir un DVI o un EPUB: **Save As** propone el nombre del archivo original
  con extensión `.pdf`, en la misma carpeta.

En general, conviene usar **Save As** después de editar o concatenar páginas,
hasta estar seguro del resultado.

Todo lo que se hace sobre el documento (resaltados, comentarios, cajas de
texto, formularios, firma digital, editar o concatenar páginas) vive solo en
memoria hasta guardar.

### Cambios sin guardar

Si el documento tiene cambios sin guardar y se intenta cerrar la aplicación o
abrir otro archivo, aparece el aviso **Unsaved changes** con tres botones:

- **Save changes**: guarda y continúa. Si el documento viene de un PDF en
  disco, lo sobrescribe; si no, abre el diálogo de **Save As**. Si ese diálogo
  se cancela, no se cierra nada.
- **Close anyway**: descarta los cambios y continúa.
- **Cancel** (o `Escape`): vuelve al documento sin cerrar nada.

---

## 12) Formularios

Los PDF con formularios se pueden llenar directamente en Folio: campos de
texto, casillas de verificación, botones de opción y listas desplegables.

Mientras se escribe en un campo de texto, los atajos de una sola tecla (`M`,
`J`, `K`, `C`) quedan desactivados, así que se puede escribir con normalidad.

Los valores ingresados quedan en el archivo solo después de guardar
(sección 11).

---

## 13) Resaltar texto

### Crear un resaltado

1. Seleccionar texto con el mouse (o con el teclado: `Shift` + flechas,
   `Ctrl` + `A`).
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
guardar (sección 11).

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
presionar **Comment**. Los demás resaltados del documento se conservan.

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
(sección 11); el propio panel lo recuerda con el aviso *Save the PDF to keep
comments in the file*.

---

## 15) Cajas de texto

Las cajas de texto permiten escribir directamente sobre la página, en cualquier
lugar, por ejemplo para completar un documento que no tiene campos de
formulario. Quedan guardadas dentro del propio PDF como anotaciones de texto
libre, así que otros lectores de PDF también las muestran.

### Agregar una caja de texto

1. **Add Text Box** en el menú contextual. El cursor cambia a una cruz.
2. Hacer click sobre la página y, sin soltar, arrastrar para dibujar el
   recuadro de la caja. Si solo se hace click sin arrastrar, la caja se crea
   con un tamaño mínimo.
3. Al soltar, la caja aparece con el texto de ejemplo *Text*, en negro y a
   12 puntos.

Para cancelar antes de dibujar, volver a elegir **Add Text Box** en el menú
contextual.

### Editar el texto

**Doble click** sobre la caja la pone en modo edición: se muestra con un borde
y un fondo gris, y el cursor de escritura queda al final del texto. Mientras se
edita, aparece encima de la caja una pequeña barra con tres botones:

- **−**: reduce el tamaño de la letra un punto.
- **+**: aumenta el tamaño de la letra un punto.
- **Papelera**: elimina la caja de texto.

El tamaño de la letra va de 6 a 72 puntos. Con un click fuera de la caja se
termina la edición y el texto queda aplicado.

### Mover y cambiar el tamaño

- **Mover**: arrastrar la caja cuando no está en modo edición. El cursor cambia
  a una mano. La caja no puede salir de los bordes de la página.
- **Cambiar el tamaño**: en modo edición, tirar de la esquina inferior derecha
  de la caja.

Las cajas de texto que el PDF ya traía de otros programas también se pueden
editar, mover y borrar de la misma forma. Como todo cambio, quedan en el
archivo solo después de guardar (sección 11).

---

## 16) Firma digital

Folio firma documentos con la **tarjeta de firma digital de Costa Rica**. Cada
firma tiene dos partes:

- La **firma digital** propiamente dicha, que queda dentro del PDF y garantiza
  quién lo firmó y que no fue modificado después.
- La **representación gráfica**: un sello visible en la página, con una imagen
  (por ejemplo, la firma escaneada) y, opcionalmente, un texto, el nombre del
  firmante y la fecha. El sello queda protegido por la firma, así que no se
  puede mover ni borrar sin invalidarla.

### Lo que se necesita

- La tarjeta de firma digital y un lector de tarjetas conectado.
- El controlador oficial de la tarjeta instalado en la computadora.
- El PIN de la tarjeta.
- Una imagen de la firma en **PNG** o **JPG**.
- Conexión a internet. Folio la usa para obtener los certificados de la
  jerarquía nacional, comprobar que el certificado de la tarjeta no esté
  revocado y pedir un sello de tiempo. Sin conexión se puede firmar igual, pero
  la firma queda incompleta (ver *Firma incompleta* más abajo).

### Configurar la representación gráfica

Se hace una sola vez; la configuración queda guardada en la computadora y se usa
en todas las firmas siguientes.

1. **Signature Appearance** en el menú contextual.
2. Pulsar **Choose image** y elegir la imagen de la firma (**PNG** o **JPG**).
   Más adelante, el mismo botón aparece como **Replace image** para cambiarla, y
   **Remove** borra la configuración.
3. Opcionalmente:
   - **Text (optional)**: un texto que aparece debajo de la imagen, por ejemplo
     el cargo.
   - **Include the signer name**: agrega el nombre del firmante, tomado del
     certificado de la tarjeta.
   - **Include the signing date**: agrega la fecha y hora de la firma, en
     formato `día/mes/año hora:minutos:segundos` con la zona horaria, por
     ejemplo `20/11/2026 14:35:02 UTC-06:00`.
4. El recuadro **Preview** muestra cómo va a quedar el sello. En la vista
   previa el nombre aparece como *Signer name*; al firmar se reemplaza por el
   nombre real.
5. Presionar **Save**.

Si se intenta firmar sin haber configurado la representación gráfica, Folio
avisa *There is no signature appearance configured yet* y ofrece el botón
**Configure**, que abre esta misma pantalla y, al cerrarla, continúa con la
firma.

### Firmar un documento

1. Insertar la tarjeta en el lector.
2. Ir a la página donde va el sello.
3. **Sign Document** en el menú contextual.
4. El sello aparece en la parte inferior de la página, con la indicación *Drag
   to move, pull the corner to resize*:
   - **Arrastrarlo** para moverlo.
   - **Tirar de la esquina inferior derecha** para cambiar el tamaño. El sello
     conserva sus proporciones.
5. Presionar **Continue**, o **Cancel** (o `Escape`) para no firmar.
6. Escribir el PIN y presionar **Sign** (o **Enter**).
7. Esperar mientras aparece el mensaje *Signing with the card. Do not remove it
   from the reader.* No retirar la tarjeta. Puede tardar unos segundos, porque
   Folio consulta los servicios de internet mencionados arriba.
8. Al terminar aparece *Document signed by &lt;nombre&gt;. Save it to keep the
   signature.* Presionar **Accept**. El documento se recarga con el sello en la
   página.
9. Guardar el documento (sección 11). Si no se guarda, la firma se pierde.

**Cancel**, `Escape` o un click fuera de la ventana del PIN cierran el diálogo
sin firmar.

### Sin sello de tiempo

El sello de tiempo es una fecha certificada por una autoridad externa. Si ese
servicio no responde, la tarjeta ya firmó pero Folio pregunta qué hacer, con el
mensaje *The timestamp service did not respond.*:

- **Sign without timestamp**: conserva la firma. Es válida, pero su fecha la
  declara la propia computadora y no se puede demostrar una vez que el
  certificado de la tarjeta venza.
- **Cancel**: descarta la firma. El documento queda como estaba.

En ningún caso hace falta volver a escribir el PIN para decidir.

### Firma incompleta

Si al firmar no se pudo obtener alguna información de internet, el mensaje de
éxito agrega un aviso en rojo:

- *The certificates of the national hierarchy could not be obtained...*: un
  validador puede advertir sobre la jerarquía de confianza.
- *The revocation status of the certificates could not be obtained...*: un
  validador puede advertir sobre el estado de revocación.
- *The signature has no certified timestamp.*: la firma no tiene sello de
  tiempo.

La firma es válida igualmente. Para incluir lo que falta, revisar la conexión
a internet y firmar de nuevo a partir del documento sin firmar.

### Orden recomendado

La firma protege el documento tal como estaba al firmar. **Cualquier cambio
posterior** (resaltar, comentar, agregar cajas de texto, llenar formularios,
editar o concatenar páginas) hace que la firma deje de cubrir el documento. Por eso:

1. Hacer primero todos los cambios.
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
| *The signing key was not found on the card.* | La tarjeta no tiene una llave de firma utilizable |
| *The certificate of this card has been revoked, so it cannot sign.* | El certificado fue revocado; hay que renovar la tarjeta |
| *Configure the signature appearance before signing.* | Configurar la representación gráfica (**Signature Appearance**) |
| *The signature image could not be used. Choose it again in Signature Appearance.* | Volver a elegir la imagen en **Signature Appearance** |
| *That file is not a valid PNG or JPG image.* | Elegir una imagen PNG o JPG válida |
| *The page is no longer available.* | Volver a la página y repetir **Sign Document** |
| *The document could not be signed. Try again.* | Error inesperado; volver a intentar |

Después de un error de firma, **Try again** vuelve a pedir el PIN, conservando
la posición del sello, y **Close** cierra el diálogo.

### Verificar un documento firmado

Al abrir un PDF que tiene firmas digitales, aparece una etiqueta en la esquina
superior derecha. A los pocos segundos se reduce a un ícono, para no estorbar la
lectura.

| Etiqueta | Significado |
| --- | --- |
| Verde: *Signed by &lt;nombre&gt;* | Firmado por una persona; la firma es válida y el documento no cambió |
| Verde: *Signed by N people* | Varias personas firmaron y todas las firmas son válidas |
| Ámbar: *Modified after signing* | Las firmas son válidas, pero el documento recibió cambios después de firmarse |
| Rojo: *Signature not valid* | Alguna firma no corresponde al contenido del documento |

Pasar el mouse sobre la etiqueta (o sobre el ícono) muestra el detalle:

- Cada firmante con la fecha y hora de su firma. Si la fecha está certificada
  por un sello de tiempo, se indica con *certified date*. Si una misma persona
  firmó varias veces, aparece una sola vez con el número de firmas.
- Las firmas que no son válidas aparecen marcadas con *The signature does not
  match the content*.
- Si el documento tiene sellos de tiempo de documento, aparecen como
  *Timestamp: &lt;fecha&gt;*.

Si el documento no tiene firmas, no aparece ninguna etiqueta.

---

## 17) Resumen de atajos

| Atajo | Acción |
| --- | --- |
| Click derecho o `M` | Abrir el menú de acciones |
| `J` / `K` | Página siguiente / anterior |
| `Ctrl` + `F` | Abrir la búsqueda |
| `Enter` / `Shift` + `Enter` | Coincidencia siguiente / anterior |
| `Escape` | Cerrar la búsqueda, la paleta de resaltado, la ventana de un comentario, el aviso de cambios sin guardar o los diálogos de firma; cancelar la colocación del sello; salir del modo presentación |
| `Ctrl` + `Enter` | Aceptar la edición de un comentario |
| `Ctrl` + `+` / `Ctrl` + `-` | Acercar / alejar |
| `Ctrl` + rueda | Zoom sobre el cursor |
| `Ctrl` + `V` | Abrir un PDF copiado, o concatenarlo si ya hay uno abierto |
| `C` | Copiar el texto seleccionado |
| Doble click sobre una caja de texto | Editar su texto |
| `→` / `←` | Cambiar de página en modo presentación |

Los atajos de una sola tecla (`M`, `J`, `K`, `C`) no se activan mientras se
escribe en un campo de texto (búsqueda, contador de páginas, comentarios,
cajas de texto, formularios o PIN).

---

## 18) Problemas frecuentes

**Solté un PDF y en vez de abrirlo lo pegó al final del otro.** Es el
comportamiento actual: soltar o pegar con un documento abierto concatena. Para
reemplazar, usar **Open New File**.

**No aparece la opción Save.** Ocurre cuando el documento no viene de un PDF en
disco: después de concatenar, o al abrir un DVI o un EPUB. Usar **Save As**.

**No puedo abrir un archivo DVI.** Folio necesita TeX Live o MiKTeX instalados
para convertirlo. Si están instalados y aun así falla, revisar que las
imágenes que usa el documento estén en la misma carpeta que el `.dvi`.

**Los números de las miniaturas quedaron desordenados.** Pasa mientras se
editan las páginas y es esperado: las etiquetas conservan la página original
hasta que se presiona **Accept**.

**Arrastré una miniatura y se ve en blanco.** Las miniaturas se generan conforme
entran en pantalla. Si se arrastra una que aún no se ha dibujado, se ve vacía,
pero la página se mueve igual.

**La pestaña Outline está vacía.** El PDF no trae índice incorporado. Es común
en documentos escaneados o exportados desde procesadores de texto sin estilos de
título.

**Sign Document pide configurar algo antes de firmar.** Falta la representación
gráfica de la firma. Pulsar **Configure** y elegir la imagen (sección 16).

**La firma dice que no tiene sello de tiempo o que está incompleta.** Folio no
pudo conectarse a los servicios de firma digital. Revisar la conexión a
internet y volver a firmar a partir del documento sin firmar.

**Firmé, cerré y la firma no está.** La firma vive en memoria hasta guardar.
Hay que usar **Save** o **Save As** después de firmar.
