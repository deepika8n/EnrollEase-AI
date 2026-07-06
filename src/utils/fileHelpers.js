export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export const aadhaarFileAccept = ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf";

export function isPdfSource(source) {
  const value = String(source || "").toLowerCase();
  return value.startsWith("data:application/pdf") || /\.pdf($|[?#])/i.test(value);
}

export function isImageSource(source) {
  const value = String(source || "").toLowerCase();
  return (
    value.startsWith("data:image/")
    || /\.(png|jpe?g|gif|webp|bmp|svg|avif)($|[?#])/i.test(value)
  );
}

export function isOpenableSource(source) {
  const value = String(source || "").trim();
  if (!value || value === "#") return false;

  return (
    value.startsWith("data:")
    || value.startsWith("blob:")
    || /^https?:\/\//i.test(value)
    || value.startsWith("/")
    || /\.(png|jpe?g|gif|webp|bmp|svg|avif|pdf)($|[?#])/i.test(value)
  );
}

export function getDocumentSourceKind(source) {
  if (isImageSource(source)) return "image";
  if (isPdfSource(source)) return "pdf";
  if (isOpenableSource(source)) return "file";
  return "unavailable";
}

export function getDocumentFileName(source, fallback = "Document") {
  const value = String(source || "").trim();
  if (!value || value === "#") return fallback;

  if (value.startsWith("data:image/")) {
    const match = value.match(/^data:image\/([a-z0-9.+-]+);/i);
    const extension = match?.[1]?.toLowerCase() === "jpeg" ? "jpg" : (match?.[1] || "png").toLowerCase();
    return `${fallback}.${extension}`;
  }

  if (value.startsWith("data:application/pdf")) {
    return `${fallback}.pdf`;
  }

  try {
    const withoutQuery = value.split(/[?#]/, 1)[0];
    const segment = withoutQuery.split("/").filter(Boolean).pop();
    return segment || fallback;
  } catch {
    return fallback;
  }
}

export function openDocumentFile(source) {
  const value = String(source || "").trim();
  if (!value || value === "#") return;
  window.open(value, "_blank", "noopener,noreferrer");
}

export function downloadDocumentFile(source, fileName = "document") {
  const value = String(source || "").trim();
  if (!value || value === "#") return;

  const link = document.createElement("a");
  link.href = value;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += character;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  const [headers = [], ...bodyRows] = rows;
  return bodyRows.map((item) =>
    headers.reduce((accumulator, header, index) => {
      accumulator[header.trim()] = (item[index] || "").trim();
      return accumulator;
    }, {}),
  );
}

export function downloadTextFile(fileName, content, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
