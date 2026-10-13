export function philippineDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isSundayInPhilippines(now = new Date()) {
  return new Date(`${philippineDate(now)}T00:00:00Z`).getUTCDay() === 0;
}

export function latestSunday(now = new Date()) {
  const date = new Date(`${philippineDate(now)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

export function validAttendanceDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && date.getUTCDay() === 0 && value <= philippineDate(now);
}

export const QR_REQUIRED_MESSAGE = "Please scan an active Sunday Service QR code or use the link shared by the church. ARC reflections and prayer requests are available any day while the event and link are active and the link has not expired.";
