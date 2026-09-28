# Lector PDF Minimalista — Manual de usuario

Guía de uso de la aplicación para personas usuarias finales. Describe únicamente
las funciones disponibles en la rama `develop`.

---

## 1) Primeros pasos

### Instalación

Ver el `README.md` del repositorio. En resumen: `npm ci` para instalar las
dependencias y `npm start` para levantar la aplicación.

### La ventana

La aplicación abre una ventana sin marco del sistema operativo. Esto significa
que no hay barra de título ni botones de minimizar, maximizar y cerrar.

- **Mover la ventana**: arrastrar desde la franja superior de la ventana.
- **Cerrar la aplicación**: click derecho en cualquier parte y elegir
  **Close Application**.

### El menú contextual

Casi todas las acciones sobre el documento viven en el menú de click derecho.
Sus opciones cambian según haya o no un PDF abierto.

| Opción | Disponible | Qué hace |
| --- | --- | --- |
| Open New File | Siempre | Abre el selector de archivos |
| Save As | Con un PDF abierto | Guarda una copia con otro nombre o ubicación |
| Save | Con un PDF abierto | Sobrescribe el archivo original |
| Delete Pages | Con un PDF abierto | Abre el diálogo para eliminar páginas |
| Concatenate Files | Con un PDF abierto | Aún no implementada |
| Merge Files | Con un PDF abierto | Aún no implementada |
| Open in Presentation Mode | Con un PDF abierto | Abre el modo presentación |
| Close Application | Siempre | Cierra la aplicación |

---

## 2) Abrir un documento

Al iniciar la aplicación aparece la pantalla de bienvenida con el botón
**Open PDF Document...** en el centro. También se puede usar **Open New File**
del menú contextual en cualquier momento.

Al abrir un documento, la aplicación se recarga y muestra el PDF. Solo se
trabaja con un documento a la vez: abrir otro reemplaza el actual.

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

### Panel lateral

El botón de hamburguesa en la esquina superior izquierda abre y cierra el panel
lateral. Un segundo click sobre el mismo botón lo cierra. El panel tiene dos
pestañas:

- **Pages**: miniaturas de todas las páginas. La página en la que se está
  leyendo queda marcada y el panel la sigue automáticamente durante el scroll.
  Un click sobre una miniatura salta a esa página.
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
2. En el diálogo, escribir los números de las páginas a eliminar separados por
   coma, por ejemplo `2,5,9`.
3. Presionar **Aceptar**.

El documento se recarga sin esas páginas. **Escape**, el botón **Cancel** o un
click fuera del diálogo lo cierran sin cambios.

El cambio ocurre solo en el documento abierto: el archivo en disco no se
modifica hasta guardarlo.

---

## 10) Guardar

Ambas opciones están en el menú contextual.

- **Save** sobrescribe el archivo original en su ubicación actual. Al terminar
  aparece por unos segundos el mensaje *PDF saved successfully* en la esquina
  inferior derecha.
- **Save As** abre el diálogo del sistema para elegir nombre y carpeta, y deja
  el archivo original intacto.

Conviene usar **Save As** después de eliminar páginas, hasta estar seguro del
resultado.

---

## 11) Resumen de atajos

| Atajo | Acción |
| --- | --- |
| `Ctrl` + `F` | Abrir la búsqueda |
| `Enter` / `Shift` + `Enter` | Coincidencia siguiente / anterior |
| `Escape` | Cerrar la búsqueda, el diálogo de páginas o el modo presentación |
| `Ctrl` + `+` / `Ctrl` + `-` | Acercar / alejar |
| `Ctrl` + rueda | Zoom sobre el cursor |
| `C` | Copiar el texto seleccionado |
| `→` / `←` | Cambiar de página en modo presentación |
| Click derecho | Abrir el menú de acciones |

---

## 12) Problemas frecuentes

**La pestaña Outline está vacía.** El PDF no trae índice incorporado. Es común
en documentos escaneados o exportados desde procesadores de texto sin estilos de
título.

**Las miniaturas tardan en aparecer.** Se generan conforme entran en pantalla.
En documentos muy grandes, las primeras de cada tramo tardan un momento.

**Concatenate Files y Merge Files no hacen nada.** Todavía no están
implementadas.

**No encuentro el botón de cerrar.** La ventana no tiene marco del sistema. Se
cierra con **Close Application** del menú contextual.