import { useEffect, useMemo, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocumentFileName, getDocumentSourceKind, isOpenableSource } from "../utils/fileHelpers";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function PreviewShell({ children, className = "" }) {
  return (
    <div
      className={`flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-slate-200 bg-white p-5 text-center ${className}`.trim()}
    >
      {children}
    </div>
  );
}

function PdfIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75v4.5H18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 14.25h1.125a1.125 1.125 0 0 0 0-2.25H8.625v4.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5h1.125a1.875 1.875 0 0 0 0-3.75H12v3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.125 16.5v-3.75h2.25" />
      </svg>
    </div>
  );
}

function FileIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6l4.5 4.5v10.5A1.5 1.5 0 0 1 16.5 20.25h-9A1.5 1.5 0 0 1 6 18.75v-13.5A1.5 1.5 0 0 1 7.5 3.75Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75v4.5H18" />
      </svg>
    </div>
  );
}

function dataUrlToUint8Array(source) {
  const [, base64 = ""] = String(source || "").split(",", 2);
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function buildPdfLoadingSource(source) {
  if (String(source || "").startsWith("data:application/pdf")) {
    return { data: dataUrlToUint8Array(source) };
  }

  return source;
}

function FallbackCard({ kind, fileName, className = "" }) {
  const isPdf = kind === "pdf";

  return (
    <PreviewShell className={className}>
      {isPdf ? <PdfIcon /> : <FileIcon />}
      <p className="text-base font-semibold text-slate-900">{isPdf ? "PDF Document" : "Document available"}</p>
      <p className="max-w-full break-words text-sm text-slate-500">{fileName}</p>
    </PreviewShell>
  );
}

export default function DocumentPreview({ src, alt, title, fileName, className = "" }) {
  const [hasImageError, setHasImageError] = useState(false);
  const [pdfThumbnail, setPdfThumbnail] = useState("");
  const [pdfStatus, setPdfStatus] = useState("idle");
  const sourceKind = getDocumentSourceKind(src);
  const displayName = useMemo(
    () => fileName || getDocumentFileName(src, title || alt || "Document"),
    [alt, fileName, src, title],
  );

  useEffect(() => {
    setHasImageError(false);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let loadingTask = null;
    let activeDocument = null;

    setPdfThumbnail("");

    if (sourceKind !== "pdf") {
      setPdfStatus("idle");
      return () => {};
    }

    const renderPdfThumbnail = async () => {
      setPdfStatus("loading");

      try {
        loadingTask = getDocument(buildPdfLoadingSource(src));
        activeDocument = await loadingTask.promise;

        const page = await activeDocument.getPage(1);
        const initialViewport = page.getViewport({ scale: 1 });
        const maxPreviewHeight = 250;
        const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
        const renderScale = (maxPreviewHeight / initialViewport.height) * deviceScale;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Canvas context unavailable");
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
          canvas,
          canvasContext: context,
          viewport,
        }).promise;

        if (cancelled) return;

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob((nextBlob) => {
            if (nextBlob) {
              resolve(nextBlob);
              return;
            }

            reject(new Error("Unable to generate PDF thumbnail"));
          }, "image/png");
        });

        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setPdfThumbnail(objectUrl);
          setPdfStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setPdfThumbnail("");
          setPdfStatus("error");
        }
      }
    };

    void renderPdfThumbnail();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }

      if (activeDocument) {
        activeDocument.cleanup();
        if (typeof activeDocument.destroy === "function") {
          void activeDocument.destroy();
        }
      }

      if (loadingTask) {
        loadingTask.destroy();
      }
    };
  }, [sourceKind, src]);

  if (!String(src || "").trim() || String(src || "").trim() === "#") {
    return (
      <PreviewShell className={className}>
        <p className="text-base font-semibold text-slate-900">No document uploaded</p>
      </PreviewShell>
    );
  }

  if (sourceKind === "image" && !hasImageError) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setHasImageError(true)}
        className={className || "h-full min-h-[220px] w-full rounded-[24px] border border-slate-200 bg-white object-cover"}
      />
    );
  }

  if (sourceKind === "pdf") {
    if (pdfStatus === "ready" && pdfThumbnail) {
      return (
        <img
          src={pdfThumbnail}
          alt={alt}
          className={className || "h-full min-h-[220px] w-full rounded-[24px] border border-slate-200 bg-white object-contain"}
        />
      );
    }

    if (pdfStatus === "loading") {
      return (
        <PreviewShell className={className}>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-500">Loading preview...</p>
        </PreviewShell>
      );
    }

    return <FallbackCard kind="pdf" fileName={displayName} className={className} />;
  }

  if (isOpenableSource(src)) {
    return <FallbackCard kind="file" fileName={displayName} className={className} />;
  }

  return (
    <PreviewShell className={className}>
      <p className="text-base font-semibold text-slate-900">No document uploaded</p>
    </PreviewShell>
  );
}
