import jsPDF from "jspdf";
import { isPdfSource } from "../utils/fileHelpers";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  formatPaymentTypeDisplay,
  inferPaymentPlan,
  normalizePaymentHistoryList,
  resolveAmountPaid,
  resolveLastPaymentDate,
  resolveNextDueDate,
  resolveRemainingAmount,
  toNumberOrNull,
} from "../utils/paymentHelpers";

const COLORS = {
  header: [18, 183, 132],
  border: [221, 229, 238],
  cardFill: [250, 252, 255],
  tableStripe: [246, 249, 252],
  title: [15, 23, 42],
  text: [30, 41, 59],
  muted: [100, 116, 139],
  white: [255, 255, 255],
  placeholder: [226, 232, 240],
};

const PAGE = {
  marginX: 14,
  marginTop: 14,
  marginBottom: 14,
  sectionGap: 7,
};

const FONT = {
  headerTitle: 20,
  headerSubtitle: 10,
  sectionTitle: 14,
  label: 9.3,
  value: 10.3,
  body: 10,
  tableHeader: 9.1,
  tableBody: 9.5,
  footer: 8,
};

const LINE = {
  label: 4,
  value: 4.6,
  body: 4.7,
  table: 4.5,
};

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function safeValue(value) {
  return hasValue(value) ? String(value) : "N/A";
}

function formatCurrencyValue(value) {
  return value === null || value === undefined ? "N/A" : formatCurrency(value);
}

function getInitials(name = "") {
  const initials = String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return initials || "NA";
}

function normalizeTextLines(doc, value, maxWidth, fontSize, fontStyle = "normal") {
  const chunks = safeValue(value).split(/\r?\n/);
  const lines = [];

  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);

  chunks.forEach((chunk, index) => {
    const wrapped = doc.splitTextToSize(chunk || " ", maxWidth);
    if (Array.isArray(wrapped) && wrapped.length) {
      lines.push(...wrapped.map((line) => String(line)));
    } else {
      lines.push(String(wrapped || " "));
    }

    if (index < chunks.length - 1) {
      lines.push("");
    }
  });

  return lines.length ? lines : ["N/A"];
}

function drawTextLines(doc, lines, x, y, { fontSize, fontStyle = "normal", color = COLORS.text, lineHeight = LINE.body, align = "left" }) {
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);

  lines.forEach((line, index) => {
    doc.text(String(line), x, y + (index * lineHeight), { baseline: "top", align });
  });
}

function measureLines(lines, lineHeight) {
  return lines.length * lineHeight;
}

function getPageSize(doc) {
  return {
    width: doc.internal.pageSize.getWidth(),
    height: doc.internal.pageSize.getHeight(),
  };
}

function inferImageFormat(image) {
  const value = String(image || "").toLowerCase();
  if (value.startsWith("data:image/png")) return "PNG";
  if (value.startsWith("data:image/jpeg") || value.startsWith("data:image/jpg")) return "JPEG";
  if (value.startsWith("data:image/webp")) return "WEBP";
  return "";
}

function tryAddImage(doc, image, x, y, width, height) {
  const format = inferImageFormat(image);
  if (!format) return false;

  try {
    doc.addImage(image, format, x, y, width, height, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

async function resolveRenderableImage(source) {
  const value = String(source || "").trim();
  if (!value) return "";
  if (value.startsWith("data:image/")) return value;

  if (value.startsWith("blob:") || /^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value);
      if (!response.ok) return "";
      return await blobToDataUrl(await response.blob());
    } catch {
      return "";
    }
  }

  return "";
}

function drawCard(doc, x, y, width, height, title) {
  doc.setDrawColor(...COLORS.border);
  doc.setFillColor(...COLORS.cardFill);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, width, height, 6, 6, "FD");

  doc.setDrawColor(...COLORS.header);
  doc.setLineWidth(0.8);
  doc.line(x + 8, y + 10.5, x + 22, y + 10.5);

  drawTextLines(doc, [title], x + 8, y + 6.2, {
    fontSize: FONT.sectionTitle,
    fontStyle: "bold",
    color: COLORS.title,
    lineHeight: 5,
  });
}

function prepareFieldGrid(doc, fields, width, columns = 1, columnGap = 8, rowGap = 4) {
  const safeColumns = Math.max(columns, 1);
  const cellWidth = (width - (columnGap * (safeColumns - 1))) / safeColumns;
  const items = fields.map((field) => {
    const valueLines = normalizeTextLines(doc, field.value, cellWidth, FONT.value, "normal");
    const height = LINE.label + 1.2 + measureLines(valueLines, LINE.value);

    return {
      label: safeValue(field.label),
      valueLines,
      height,
    };
  });

  const rows = [];
  let totalHeight = 0;

  for (let index = 0; index < items.length; index += safeColumns) {
    const rowItems = items.slice(index, index + safeColumns);
    const rowHeight = Math.max(...rowItems.map((item) => item.height));
    rows.push({ items: rowItems, rowHeight });
    totalHeight += rowHeight;
    if (index + safeColumns < items.length) {
      totalHeight += rowGap;
    }
  }

  return {
    rows,
    cellWidth,
    columns: safeColumns,
    columnGap,
    rowGap,
    totalHeight,
  };
}

function renderFieldGrid(doc, layout, x, y) {
  let currentY = y;

  layout.rows.forEach((row) => {
    row.items.forEach((item, index) => {
      const itemX = x + (index * (layout.cellWidth + layout.columnGap));
      drawTextLines(doc, [item.label], itemX, currentY, {
        fontSize: FONT.label,
        fontStyle: "bold",
        color: COLORS.muted,
        lineHeight: LINE.label,
      });
      drawTextLines(doc, item.valueLines, itemX, currentY + LINE.label + 1.2, {
        fontSize: FONT.value,
        color: COLORS.text,
        lineHeight: LINE.value,
      });
    });

    currentY += row.rowHeight + layout.rowGap;
  });

  return currentY - layout.rowGap;
}

function buildNoteBlocks(doc, notes, width) {
  return notes.map((note) => {
    const labelLines = normalizeTextLines(doc, note.label, width, FONT.label, "bold");
    const valueLines = normalizeTextLines(doc, note.value, width, FONT.body, "normal");
    const height = measureLines(labelLines, LINE.label) + 1.4 + measureLines(valueLines, LINE.body);

    return {
      labelLines,
      valueLines,
      height,
    };
  });
}

function drawNoteBlocks(doc, x, y, width, notes) {
  const blocks = buildNoteBlocks(doc, notes, width);
  let currentY = y;

  blocks.forEach((block, index) => {
    drawTextLines(doc, block.labelLines, x, currentY, {
      fontSize: FONT.label,
      fontStyle: "bold",
      color: COLORS.muted,
      lineHeight: LINE.label,
    });
    drawTextLines(doc, block.valueLines, x, currentY + measureLines(block.labelLines, LINE.label) + 1.4, {
      fontSize: FONT.body,
      color: COLORS.text,
      lineHeight: LINE.body,
    });
    currentY += block.height;
    if (index < blocks.length - 1) {
      currentY += 4;
    }
  });

  return currentY;
}

function measureNoteBlocks(doc, notes, width) {
  const blocks = buildNoteBlocks(doc, notes, width);
  return blocks.reduce((sum, block, index) => sum + block.height + (index < blocks.length - 1 ? 4 : 0), 0);
}

function addPageFooters(doc) {
  const { width, height } = getPageSize(doc);
  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawTextLines(doc, [`Admission profile report | Page ${page} of ${totalPages}`], width - PAGE.marginX, height - 7, {
      fontSize: FONT.footer,
      color: COLORS.muted,
      lineHeight: 3.5,
      align: "right",
    });
  }
}

function drawHeader(doc, instituteName, studentName, photoImage) {
  const { width } = getPageSize(doc);
  const headerX = PAGE.marginX;
  const headerY = PAGE.marginTop;
  const headerWidth = width - (PAGE.marginX * 2);
  const headerHeight = 31;
  const photoSize = 20;
  const photoOuterSize = 24;
  const photoX = headerX + headerWidth - photoOuterSize - 8;
  const photoY = headerY + ((headerHeight - photoOuterSize) / 2);

  doc.setFillColor(...COLORS.header);
  doc.roundedRect(headerX, headerY, headerWidth, headerHeight, 7, 7, "F");

  drawTextLines(doc, [safeValue(instituteName || "EnrollEase AI Institute")], headerX + 6, headerY + 7.2, {
    fontSize: FONT.headerTitle,
    fontStyle: "bold",
    color: COLORS.white,
    lineHeight: 6.2,
  });
  drawTextLines(doc, ["Individual student profile summary"], headerX + 6, headerY + 16.8, {
    fontSize: FONT.headerSubtitle,
    color: COLORS.white,
    lineHeight: 4,
  });
  drawTextLines(doc, [safeValue(studentName)], headerX + 6, headerY + 21.8, {
    fontSize: 9.5,
    fontStyle: "bold",
    color: COLORS.white,
    lineHeight: 4,
  });

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(8, 47, 73);
  doc.setLineWidth(0.5);
  doc.roundedRect(photoX, photoY, photoOuterSize, photoOuterSize, 3, 3, "FD");

  const imageAdded = tryAddImage(doc, photoImage, photoX + 2, photoY + 2, photoSize, photoSize);
  if (!imageAdded) {
    doc.setFillColor(...COLORS.placeholder);
    doc.roundedRect(photoX + 2, photoY + 2, photoSize, photoSize, 2.5, 2.5, "F");
    drawTextLines(doc, [getInitials(studentName)], photoX + (photoOuterSize / 2), photoY + 8.2, {
      fontSize: 11,
      fontStyle: "bold",
      color: COLORS.text,
      lineHeight: 4,
      align: "center",
    });
  }

  return headerY + headerHeight + PAGE.sectionGap;
}

function drawPairedCards(doc, startY, leftCard, rightCard) {
  const { width, height } = getPageSize(doc);
  const cardGap = 8;
  const cardWidth = (width - (PAGE.marginX * 2) - cardGap) / 2;
  const cardPadding = 8;
  const cardTitleHeight = 12;
  const usableWidth = cardWidth - (cardPadding * 2);
  const leftLayout = prepareFieldGrid(doc, leftCard.fields, usableWidth, 1, 0, 4);
  const rightLayout = prepareFieldGrid(doc, rightCard.fields, usableWidth, 1, 0, 4);
  const rowHeight = Math.max(
    cardTitleHeight + (cardPadding * 2) + leftLayout.totalHeight,
    cardTitleHeight + (cardPadding * 2) + rightLayout.totalHeight,
  );

  let y = startY;
  if (y + rowHeight > height - PAGE.marginBottom) {
    doc.addPage();
    y = PAGE.marginTop;
  }

  drawCard(doc, PAGE.marginX, y, cardWidth, rowHeight, leftCard.title);
  renderFieldGrid(doc, leftLayout, PAGE.marginX + cardPadding, y + cardTitleHeight + 4);

  drawCard(doc, PAGE.marginX + cardWidth + cardGap, y, cardWidth, rowHeight, rightCard.title);
  renderFieldGrid(doc, rightLayout, PAGE.marginX + cardWidth + cardGap + cardPadding, y + cardTitleHeight + 4);

  return y + rowHeight + PAGE.sectionGap;
}

function drawNotesSection(doc, startY, title, gridFields, notes, columns = 2) {
  const { width, height } = getPageSize(doc);
  const cardX = PAGE.marginX;
  const cardWidth = width - (PAGE.marginX * 2);
  const cardPadding = 8;
  const cardTitleHeight = 12;
  const innerWidth = cardWidth - (cardPadding * 2);
  const gridLayout = prepareFieldGrid(doc, gridFields, innerWidth, columns, 10, 5);
  const notesHeight = measureNoteBlocks(doc, notes, innerWidth);
  const contentGap = notes.length ? 6 : 0;
  const cardHeight = cardTitleHeight + (cardPadding * 2) + gridLayout.totalHeight + contentGap + notesHeight;

  let y = startY;
  if (y + cardHeight > height - PAGE.marginBottom) {
    doc.addPage();
    y = PAGE.marginTop;
  }

  drawCard(doc, cardX, y, cardWidth, cardHeight, title);
  const contentStartY = y + cardTitleHeight + 4;
  renderFieldGrid(doc, gridLayout, cardX + cardPadding, contentStartY);
  if (notes.length) {
    drawNoteBlocks(doc, cardX + cardPadding, contentStartY + gridLayout.totalHeight + contentGap, innerWidth, notes);
  }

  return y + cardHeight + PAGE.sectionGap;
}

function buildTimelineRows(doc, paymentHistory) {
  const columns = [
    { key: "date", label: "Date", width: 20, align: "left" },
    { key: "entry", label: "Entry", width: 42, align: "left" },
    { key: "method", label: "Method", width: 21, align: "left" },
    { key: "type", label: "Type", width: 23, align: "left" },
    { key: "paid", label: "Paid", width: 28, align: "right" },
    { key: "pending", label: "Pending", width: 28, align: "right" },
  ];

  const rows = paymentHistory.map((payment) => {
    const values = {
      date: formatDate(payment.date),
      entry: safeValue(payment.label),
      method: safeValue(payment.payment_method || payment.mode),
      type: safeValue(payment.payment_type),
      paid: formatCurrencyValue(payment.paid_amount ?? payment.amount),
      pending: formatCurrencyValue(payment.pending_amount),
    };

    const cellLines = columns.map((column) => ({
      ...column,
      lines: normalizeTextLines(doc, values[column.key], column.width - 2, FONT.tableBody, "normal"),
    }));
    const rowHeight = Math.max(...cellLines.map((column) => measureLines(column.lines, LINE.table))) + 3;

    return { cellLines, rowHeight };
  });

  return { columns, rows };
}

function drawTimelineTable(doc, startY, paymentHistory) {
  const { width, height } = getPageSize(doc);
  const cardX = PAGE.marginX;
  const cardWidth = width - (PAGE.marginX * 2);
  const cardPadding = 8;
  const cardTitleHeight = 12;
  const innerX = cardX + cardPadding;
  const innerWidth = cardWidth - (cardPadding * 2);
  const tableX = innerX;
  const headerHeight = 8;
  const emptyStateHeight = 16;

  if (!paymentHistory.length) {
    let y = startY;
    const cardHeight = cardTitleHeight + (cardPadding * 2) + emptyStateHeight;
    if (y + cardHeight > height - PAGE.marginBottom) {
      doc.addPage();
      y = PAGE.marginTop;
    }

    drawCard(doc, cardX, y, cardWidth, cardHeight, "Payment Timeline");
    drawTextLines(doc, ["No payment entries recorded yet."], innerX, y + cardTitleHeight + 5, {
      fontSize: FONT.body,
      color: COLORS.text,
      lineHeight: LINE.body,
    });

    return y + cardHeight + PAGE.sectionGap;
  }

  const table = buildTimelineRows(doc, paymentHistory);
  let y = startY;
  let rowIndex = 0;
  let firstSegment = true;

  while (rowIndex < table.rows.length) {
    const title = firstSegment ? "Payment Timeline" : "Payment Timeline (cont.)";
    const minCardHeight = cardTitleHeight + (cardPadding * 2) + headerHeight + table.rows[rowIndex].rowHeight;
    if (y + minCardHeight > height - PAGE.marginBottom) {
      doc.addPage();
      y = PAGE.marginTop;
    }

    let usedHeight = cardTitleHeight + cardPadding + headerHeight + 4;
    const segmentRows = [];

    while (rowIndex < table.rows.length) {
      const nextRowHeight = table.rows[rowIndex].rowHeight;
      const predictedHeight = usedHeight + nextRowHeight + cardPadding;
      if (segmentRows.length && y + predictedHeight > height - PAGE.marginBottom) {
        break;
      }

      if (!segmentRows.length && y + predictedHeight > height - PAGE.marginBottom) {
        doc.addPage();
        y = PAGE.marginTop;
        usedHeight = cardTitleHeight + cardPadding + headerHeight + 4;
      }

      segmentRows.push(table.rows[rowIndex]);
      usedHeight += nextRowHeight;
      rowIndex += 1;
    }

    const cardHeight = usedHeight + cardPadding;
    drawCard(doc, cardX, y, cardWidth, cardHeight, title);

    const headerY = y + cardTitleHeight + 5;
    doc.setFillColor(...COLORS.placeholder);
    doc.roundedRect(tableX, headerY, innerWidth, headerHeight, 2.5, 2.5, "F");

    let cursorX = tableX + 2;
    table.columns.forEach((column) => {
      drawTextLines(doc, [column.label], column.align === "right" ? cursorX + column.width - 2 : cursorX, headerY + 2.2, {
        fontSize: FONT.tableHeader,
        fontStyle: "bold",
        color: COLORS.title,
        lineHeight: 3.8,
        align: column.align,
      });
      cursorX += column.width;
    });

    let rowY = headerY + headerHeight + 3;
    segmentRows.forEach((row, index) => {
      if (index % 2 === 1) {
        doc.setFillColor(...COLORS.tableStripe);
        doc.roundedRect(tableX, rowY - 1, innerWidth, row.rowHeight, 2, 2, "F");
      }

      let cellX = tableX + 2;
      row.cellLines.forEach((column) => {
        const textX = column.align === "right" ? cellX + column.width - 4 : cellX;
        drawTextLines(doc, column.lines, textX, rowY + 1, {
          fontSize: FONT.tableBody,
          color: COLORS.text,
          lineHeight: LINE.table,
          align: column.align,
        });
        cellX += column.width;
      });

      rowY += row.rowHeight;
    });

    y += cardHeight + PAGE.sectionGap;
    firstSegment = false;
  }

  return y;
}

export async function generateEnrollmentPdf({ instituteName, student, course, enrollment, remarks }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const courseFee = toNumberOrNull(enrollment.total_fee) ?? toNumberOrNull(course?.fee);
  const amountPaid = resolveAmountPaid(enrollment.amount_paid, enrollment.payment_history);
  const paymentPlan = inferPaymentPlan({
    paymentPlan: enrollment.payment_plan || "",
    installmentsPlanned: enrollment.installments_planned || 0,
    history: enrollment.payment_history,
    amountPaid,
  });
  const paymentMethod = enrollment.payment_method || "";
  const paymentHistory = normalizePaymentHistoryList(enrollment.payment_history, {
    totalFee: courseFee,
    paymentPlan,
    paymentMethod,
    installmentsPlanned: enrollment.installments_planned || 0,
    amountPaid,
  });
  const remainingAmount = resolveRemainingAmount(courseFee, amountPaid);
  const leadDate = enrollment.lead_date || enrollment.created_at;
  const enrolledDate = enrollment.enrolled_date || (enrollment.enrollment_status === "Active" ? (enrollment.created_at || enrollment.lead_date) : "");
  const lastPaymentDate = resolveLastPaymentDate({
    lastPaymentDate: enrollment.last_payment_date || "",
    history: paymentHistory,
    amountPaid,
    enrolledDate,
    leadDate,
  });
  const nextDueDate = resolveNextDueDate({
    paymentStatus: enrollment.payment_status || "",
    lastPaymentDate,
    enrolledDate,
    leadDate,
    fallbackDate: enrollment.next_due_date || "",
  });
  const enrollmentStatus = enrollment.enrollment_status === "Verified" ? "Active" : enrollment.enrollment_status;
  const studentPhoto = await resolveRenderableImage(student.photo_url);

  let cursorY = drawHeader(doc, instituteName || "EnrollEase AI Institute", student.full_name, studentPhoto);

  cursorY = drawPairedCards(doc, cursorY, {
    title: "Student Information",
    fields: [
      { label: "Student", value: student.full_name },
      { label: "Email", value: student.email },
      { label: "Phone", value: student.phone },
      { label: "Alternate Phone", value: student.alternate_phone },
      { label: "College", value: student.college_name },
      { label: "Currently Doing", value: student.current_activity },
    ],
  }, {
    title: "Admission and Payment",
    fields: [
      { label: "Course", value: course?.course_name || "N/A" },
      { label: "Batch", value: enrollment.batch },
      { label: "Lead Date", value: formatDate(leadDate) },
      { label: "Enrolled Date", value: formatDate(enrolledDate) },
      { label: "Payment Plan", value: formatPaymentTypeDisplay(paymentPlan) },
      { label: "Payment Status", value: enrollment.payment_status },
      { label: "Next Due", value: formatDate(nextDueDate) },
      { label: "Method", value: paymentMethod },
    ],
  });

  cursorY = drawNotesSection(
    doc,
    cursorY,
    "Documents and Notes",
    [
      { label: "Course Fee", value: formatCurrencyValue(courseFee) },
      { label: "Paid So Far", value: formatCurrencyValue(amountPaid) },
      { label: "Remaining", value: formatCurrencyValue(remainingAmount) },
      {
        label: "Installments",
        value: paymentPlan === "EMI"
          ? `${enrollment.installments_paid || 0}/${enrollment.installments_planned || 0}`
          : (paymentPlan ? "One time" : "N/A"),
      },
      { label: "Verification", value: enrollment.verification_status },
      { label: "Enrollment Status", value: enrollmentStatus },
      { label: "Next Due", value: formatDate(nextDueDate) },
      { label: "Method", value: paymentMethod },
    ],
    [
      { label: "Remarks", value: remarks || enrollment.remarks || "N/A" },
      { label: "Dropout Reason", value: enrollment.dropout_reason || "N/A" },
      { label: "Student Photo", value: hasValue(student.photo_url) ? "Attached" : "Not attached" },
      {
        label: "Aadhaar File",
        value: !student.aadhaar_document_url
          ? "Not attached"
          : (isPdfSource(student.aadhaar_document_url) ? "PDF attached" : "Image attached"),
      },
    ],
    2,
  );

  cursorY = drawNotesSection(
    doc,
    cursorY,
    "Address and Guardian",
    [
      { label: "Address", value: student.address },
      { label: "Guardian", value: student.guardian_name },
      { label: "Place", value: student.place },
      { label: "Relation", value: student.guardian_relation },
      { label: "Aadhaar ID", value: student.aadhaar_id },
      { label: "Guardian Phone", value: student.guardian_phone },
      { label: "Last Payment", value: formatDate(lastPaymentDate) },
      { label: "Alternate Phone", value: student.alternate_phone },
    ],
    [],
    2,
  );

  drawTimelineTable(doc, cursorY, paymentHistory);
  addPageFooters(doc);

  return doc.output("bloburl");
}

export async function openEnrollmentPdf(payload) {
  const url = await generateEnrollmentPdf(payload);
  window.open(url, "_blank", "noopener,noreferrer");
}
