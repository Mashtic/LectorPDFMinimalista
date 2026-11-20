/*
 * Formats dates as they are read in Costa Rica: day before month and a 24 hour
 * clock, with the UTC offset so the moment is unambiguous wherever the
 * document is opened. Relying on the system locale printed "11/9/2026" for
 * the 9th of November on English systems, which reads as the 11th of
 * September here.
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

function formatSigningDate(date) {
  return (
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    formatOffset(date)
  );
}

module.exports = { formatSigningDate };
