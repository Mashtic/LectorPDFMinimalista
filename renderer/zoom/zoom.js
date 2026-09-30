const DEFAULT_MIN_ZOOM = 0.5;
const DEFAULT_MAX_ZOOM = 3;
const DEFAULT_STEP = 0.15;

export function createZoomState(overrides = {}) {
  return {
    scale: 1,
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    step: DEFAULT_STEP,
    ...overrides,
  };
}

function clamp(state, value) {
  return Math.min(state.maxZoom, Math.max(state.minZoom, value));
}

export function zoomIn(state) {
  return setZoom(state, state.scale + state.step);
}

export function zoomOut(state) {
  return setZoom(state, state.scale - state.step);
}

export function setZoom(state, newScale) {
  state.scale = clamp(state, newScale);
  return state.scale;
}
