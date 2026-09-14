export function createZoomState(overrides = {}) {
  return {
    scale: 1.5,
    minZoom: 0.5,
    maxZoom: 5.0,
    step: 0.1,
    ...overrides,
  };
}

function clamp(state, value) {
  return Math.min(state.maxZoom, Math.max(state.minZoom, value));
}

export function zoomIn(state) {
  state.scale = clamp(state, state.scale + state.step);
  return state.scale;
}

export function zoomOut(state) {
  state.scale = clamp(state, state.scale - state.step);
  return state.scale;
}

export function setZoom(state, newScale) {
  state.scale = clamp(state, newScale);
  return state.scale;
}
