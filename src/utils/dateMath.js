function padNumber(value) {
  return String(value).padStart(2, "0");
}

function checkedDate(year, month, day) {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? date : null;
}

export function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, year, month, day] = match;
      return checkedDate(year, month, day);
    }

    const dayFirstMatch = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (dayFirstMatch) {
      const [, day, month, year] = dayFirstMatch;
      return checkedDate(year, month, day);
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function toIsoDate(value) {
  const date = parseDateValue(value);
  if (!date) return "";

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function addDays(dateValue, days) {
  const baseDate = parseDateValue(dateValue) || parseDateValue(new Date());
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return toIsoDate(nextDate);
}

export function addMonthsPreservingDay(dateValue, months = 1) {
  const baseDate = parseDateValue(dateValue) || parseDateValue(new Date());
  const baseDay = baseDate.getDate();
  const targetMonthIndex = baseDate.getMonth() + months;
  const targetYear = baseDate.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedTargetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedTargetMonth + 1, 0).getDate();
  const nextDate = new Date(
    targetYear,
    normalizedTargetMonth,
    Math.min(baseDay, lastDayOfTargetMonth),
  );

  return toIsoDate(nextDate);
}
