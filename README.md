# Lector PDF Minimalista

Un visor de documentos PDF de escritorio construido con Electron. Este proyecto aprovecha el motor nativo de Chromium mediante la configuración de `webPreferences`, permitiendo renderizar y leer archivos sin necesidad de instalar librerías externas complejas.

<!-- INICIO MODIFICACIÓN DE VICTOR: explica cómo leer dos PDF en la misma ventana. -->
## Lectura simultánea

Al abrir el primer archivo, se muestra en un único visor. Al seleccionar un segundo PDF, la aplicación permite elegir entre **Abrir uno nuevo** (reemplaza el documento actual) y **Abrir en simultáneo**. Esta última opción divide la misma ventana en dos visores independientes, cada uno con sus propios controles y panel de páginas. Puedes cerrar un panel con el botón `×`; si ya hay dos abiertos, el siguiente archivo reemplaza el panel que hayas seleccionado.
<!-- FIN MODIFICACIÓN DE VICTOR -->

## Requisitos Previos

Para ejecutar este proyecto, necesitas tener instalado en tu computadora:
* **Git**: Para descargar el código fuente.
* **Node.js y npm**: Indispensables para instalar las dependencias y levantar la interfaz gráfica de la aplicación.

## Configuración del Entorno

Sigue estos pasos en tu terminal para obtener una copia local y prepararla para su ejecución:

1. **Descargar el código fuente:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd LectorPDFMinimalista

### Instalar dependencias

Utiliza el siguiente comando en lugar de `npm install`. Esto asegura que se respete el archivo `package-lock.json` y se descarguen exactamente las mismas versiones que el resto del equipo, evitando errores de compatibilidad:

```bash
npm ci
```
### Ejecución
Una vez que las dependencias terminen de instalarse, arranca la aplicación con el siguiente comando:

```bash
npm start
```
