const NON_TEXT_INPUT_TYPES = [
  "button",
  "checkbox",
  "radio",
  "range",
  "submit",
  "reset",
  "file",
  "color",
];

export function isTextEntryTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
  return (
    target.tagName === "INPUT" && !NON_TEXT_INPUT_TYPES.includes(target.type)
  );
}
