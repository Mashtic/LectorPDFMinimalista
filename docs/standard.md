# LectorPDFMinimalista — Standard

> **Objetivo**: que todo el equipo nombre **funciones** y **variables** de forma *predecible y buscable*, evitando duplicados por diferencias mínimas.

---

## 0) Alcance

Aplica a **backend (Node, Electron)**, **frontend (HTML, CSS, JS)**.

---

## 1) Reglas base de estilo

- **Idioma de código**: siempre **inglés** para nombres de código.
- **Idioma de Aplicación**: siempre **inglés** para todos los textos de la aplicación.
- **Casing por categoría**:
  - **Funciones**: Nombres en `camelCase` (ej.: `renderPages`, `openFile`).
  - **Variables/params locales**: `camelCase` (ej.: `pageNumber`, `renderTask`).
  - **Clases/Interfaces/Tipos**: `PascalCase` (ej.: `PDFViewer`, `DocumentStates`).
  - **Enums (tipo)**: `PascalCase`; **miembros**: `UPPER_SNAKE_CASE` (ej.: `DocumentStates.OPENED`).
  - **Constantes** (runtime o build): `UPPER_SNAKE_CASE` (ej.: `MAX_PAGES_SHOWN`).
  - **Env vars**: `UPPER_SNAKE_CASE` (ej.: `CLOUDINARY_API_KEY`).
  - **Propiedades/Clases CSS:** `kebab-case` (ej.: `.pdf-page`, `#pdf-viewer-list`).
  - **Directorios/Archivos**: `kebab-case` (ej.: `delete-pages/`, `delete-pages.css`)
- **Abreviaturas permitidas y SIEMPRE en mayúscula**: `PDF`, `URL`. Otras abreviaturas: **evitarlas**.
- **Húngaro**: prohibido (no prefijar con tipo: `strName`, `arrUsers`).

---

## 2) Decisiones específicas

- **Sin sinónimos**: si existe `FullName`, *no* crear `DisplayName` salvo requerimiento.
- **Error-first**: funciones mutadoras devuelven objeto actualizado o lanzan error; no usar sufijos `OrNull`/`OrUndefined`.
- **Imports:** se hacen en el estilo de CommonJS.

---

## 3) Formato de Código

- **Indentación:** 2 espacios (no tabs).
- **Brackets:** Los brackets de apertura deben ir en línea con la definición del método. Ver ejemplo 5.1.
- **Espaciado entre métodos:** Dejar 1 línea vacía entre declaraciones de métodos. Ver ejemplo 5.2.

**Nota:** Usar archivo de configuración.

---

## 4) Estructura de Archivos

```
LectorPDFMinimalista/
├── renderer/
│   ├── feat1/
│   │   ├── *.js
│   │   └── *.css
│   ├── feat2/
│   │   ├── *.js
│   │   └── *.css
│   ├── index.html
│   └── renderer.js
│
├── ipc/
│   ├── method1.js
│   └── method2.js
│
├── docs/
│   ├── doc1.*
│   └── doc2.*
│
├── services/
│   ├── service1.js
│   └── service2.js
│
├── windows/
│   ├── window1.js
│   └── window2.js
│
├── main.js
└── preload.js
```

- **HTML único:** Solo debe haber un archivo html por ventana. Para la ventana principal este será `index.html`. Si se deben crear ventanas adicionales, estas deberán tener su propio archivo html único.
	- Para los archivos compartidos, añadir comentarios antes de cada sección específica de código para distinguir a que feature corresponde el bloque de código. Escritos en mayúsculas.
- **Separacion de elementos:** Todos los scripts y estilos de CSS que se necesiten usar dentro `index.html` deben ir en sus respectivos archivos para no saturar el index.

---

## 5) Ejemplos

- ### 5.1:
> **Correcto:**
```
function name() {
}
```

> **Incorrecto:**
```
function name()
{
}
```

- ### 5.2:
> **Correcto:**
```
function name1() {}

function name1() {}
```

> **Incorrecto:**
```
function name1() {}
function name1() {}
```
---

**Estado del documento**: v1.2 (base).
