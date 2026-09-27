
# Dependency Diagrams

## Main

Execute at project root:
```bash
madge --exclude electron --include-npm --basedir ./renderer --image ./docs/dependency_diagram/renderer.svg ./renderer/ preload.js
```

## Renderer


Execute at project root:
```bash
madge --exclude electron --include-npm --image ./docs/dependency_diagram/main.svg main.js
```
