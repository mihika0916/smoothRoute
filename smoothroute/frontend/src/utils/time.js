export function normalizeTime(value, fallback = "06:00") {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return fallback;
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!match) return fallback;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3];
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return fallback;
  if (meridiem) {
    if (hours < 1 || hours > 12) return fallback;
    if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
    if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
  }
  if (hours < 0 || hours > 23) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutes(time, minutesToAdd) {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  const total = (hours * 60 + minutes + minutesToAdd + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time) {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeOrderWindow(order) {
  const start = normalizeTime(order.window_start);
  const end = normalizeTime(order.window_end, addMinutes(start, 30));
  return {
    ...order,
    window_start: start,
    window_end: timeToMinutes(end) > timeToMinutes(start) ? end : addMinutes(start, 30),
  };
}
