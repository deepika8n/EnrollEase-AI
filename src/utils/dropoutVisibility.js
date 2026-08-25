const HIDDEN_DROPOUT_STUDENTS = new Set([
  "chandana k r",
]);

export function normalizeStudentName(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isHiddenDropoutStudent(record = {}) {
  return HIDDEN_DROPOUT_STUDENTS.has(normalizeStudentName(record?.student?.full_name || ""));
}

export function isVisibleDropoutRecord(record = {}) {
  return Boolean(record?.isDropoutRecord) && !isHiddenDropoutStudent(record);
}
