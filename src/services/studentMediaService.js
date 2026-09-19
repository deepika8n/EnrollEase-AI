// Keep previews separate from originals so displaying a profile stays lightweight.
export async function fetchStudentMedia(client, { studentId, enrollmentId, signal, originals = false, onProgress }) {
  const fields = originals ? "photo_url,aadhaar_document_url" : "photo_preview_url,aadhaar_preview_url";
  const { data: student, error } = await client.from("students")
    .select(fields).eq("id", studentId).abortSignal(signal).single();
  if (error) throw error;
  const urls = {
    "Student Photo": student?.photo_preview_url || student?.photo_url || "",
    "Aadhaar ID Photo": student?.aadhaar_preview_url || student?.aadhaar_document_url || "",
  };
  onProgress?.({ ...urls });
  const fieldByType = { "Student Photo": "photo_url", "Aadhaar ID Photo": "aadhaar_document_url" };
  if (!originals) {
    const missing = Object.keys(urls).filter(type => !urls[type]);
    if (missing.length) {
      const { data, error: originalError } = await client.from("students")
        .select(missing.map(type => fieldByType[type]).join(",")).eq("id", studentId).abortSignal(signal).single();
      if (originalError) throw originalError;
      for (const type of missing) urls[type] = data?.[fieldByType[type]] || "";
      onProgress?.({ ...urls });
    }
  }
  const missing = Object.keys(urls).filter(type => !urls[type]);
  if (missing.length) {
    const { data: documents, error: documentError } = await client.from("documents")
      .select("document_type,file_url").eq("enrollment_id", enrollmentId)
      .in("document_type", missing).order("uploaded_at", { ascending: false }).abortSignal(signal);
    if (documentError) throw documentError;
    for (const document of documents || []) {
      if (!urls[document.document_type]) urls[document.document_type] = document.file_url || "";
    }
  }
  return urls;
}
