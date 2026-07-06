import { hasSupabaseEnv, supabase } from "../lib/supabase";

export async function uploadDocumentPlaceholder(file, documentType) {
  if (!hasSupabaseEnv || !supabase) {
    return Promise.resolve({
      file_url: URL.createObjectURL(file),
      document_type: documentType,
      storage: "local-preview",
    });
  }

  const filePath = `documents/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("enrollment-documents").upload(filePath, file);
  if (error) throw error;

  const { data } = supabase.storage.from("enrollment-documents").getPublicUrl(filePath);
  return { file_url: data.publicUrl, document_type: documentType, storage: "supabase" };
}

export async function uploadEnrollmentDocument({
  enrollmentId,
  file,
  documentType,
  remarks = "",
  verificationStatus = "Pending",
}) {
  const upload = await uploadDocumentPlaceholder(file, documentType);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      enrollment_id: enrollmentId,
      document_type: upload.document_type,
      file_url: upload.file_url,
      verification_status: verificationStatus,
      remarks,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
