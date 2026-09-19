// File contents are deliberately excluded from the portal's login queries.
export async function fetchStudentMedia(client, { studentId, enrollmentId, signal }) {
  const { data: student, error } = await client.from("students")
    .select("photo_url,aadhaar_document_url").eq("id", studentId).abortSignal(signal).single();
  if (error) throw error;
  const urls = {
    "Student Photo": student?.photo_url || "",
    "Aadhaar ID Photo": student?.aadhaar_document_url || "",
  };
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
