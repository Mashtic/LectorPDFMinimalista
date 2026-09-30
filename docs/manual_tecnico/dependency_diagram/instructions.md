
# Dependency Diagrams

## Diagrams

### Main

Execute at project root:
```bash
madge --exclude electron --include-npm --basedir ./renderer --image ./docs/dependency_diagram/renderer.svg ./renderer/ preload.js
```

### Renderer

Execute at project root:
```bash
madge --exclude electron --include-npm --image ./docs/dependency_diagram/main.svg main.js
```

## Conversion for Latex

To use the svg inside Latex it must be converted to .pdf.

The following command uses inkscape to do the conversion: 

```bash
inkscape --export-filename=image.pdf image.svg
```

