import { parseDateValue, toIsoDate } from "./dateMath.js";

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

export const formatDate = (value) =>
  parseDateValue(value)
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(parseDateValue(value))
    : "N/A";

export const formatShortDate = (value) =>
  parseDateValue(value)
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(parseDateValue(value))
    : "N/A";

export const formatPercent = (value) => `${Math.round(value || 0)}%`;

export const formatNumber = (value) => new Intl.NumberFormat("en-IN").format(value || 0);

export const toInputDate = (value) => {
  return toIsoDate(value);
};

export const daysUntil = (value) => {
  if (!value) return null;
  const today = parseDateValue(new Date());
  today.setHours(0, 0, 0, 0);
  const target = parseDateValue(value);
  if (!target) return null;
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

export const sentenceCase = (value = "") =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
