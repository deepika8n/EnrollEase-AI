function normalizeStudentCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

function parseStudentCode(value = "") {
  const normalizedValue = normalizeStudentCode(value);
  const match = normalizedValue.match(/^(.*?)(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    numericPart: match[2],
    numericValue: Number.parseInt(match[2], 10),
  };
}

function compareStudentCodeParts(left, right) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  if (left.numericValue !== right.numericValue) {
    return left.numericValue - right.numericValue;
  }

  return left.numericPart.length - right.numericPart.length;
}

export function getNextStudentCode(existingCodes = [], fallbackPrefix = "CT") {
  const parsedCodes = existingCodes
    .map(parseStudentCode)
    .filter(Boolean);

  if (!parsedCodes.length) {
    const fallbackYear = new Date().getFullYear();
    return `${fallbackPrefix}${fallbackYear}00001`;
  }

  const latestCode = parsedCodes.reduce((highest, current) => (
    compareStudentCodeParts(current, highest) > 0 ? current : highest
  ), null);

  const nextNumericValue = String(latestCode.numericValue + 1).padStart(latestCode.numericPart.length, "0");
  return `${latestCode.prefix}${nextNumericValue}`;
}

export function getNextEnrolledStudentCode({ students = [], enrollments = [] } = {}) {
  const enrolledStudentIds = new Set(
    enrollments
      .filter((item) => String(item?.pipeline_stage || "").trim().toLowerCase() === "enrolled")
      .map((item) => item.student_id)
      .filter(Boolean),
  );

  const existingCodes = students
    .filter((student) => enrolledStudentIds.has(student.id))
    .map((student) => student.student_code)
    .filter(Boolean);

  return getNextStudentCode(existingCodes);
}
