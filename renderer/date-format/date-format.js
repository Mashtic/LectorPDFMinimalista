/*
 * Same format as services/date-format-service.js, so the preview, the stamp
 * and the signature indicator all show a date the same way: day before month,
 * 24 hour clock and the UTC offset.
 */

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatOffset(date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);

  return `UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function formatSigningDate(date) {
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    formatOffset(date)
  );
}
