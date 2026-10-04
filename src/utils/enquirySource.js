export function getEnquirySourceMeta({ leadSource = "", hasReachableEmail = false } = {}) {
  const normalizedSource = String(leadSource || "").trim().toLowerCase();

  if (["public enquiry form", "online enquiry"].includes(normalizedSource)) {
    return { key: "app", label: "Enquired Through App" };
  }
  if (normalizedSource === "csv upload") {
    return { key: "csv", label: "Imported From Excel" };
  }
  if (normalizedSource === "manual form") {
    return hasReachableEmail
      ? { key: "manual_email", label: "Admin Sent Form By Mail" }
      : { key: "admin_only", label: "Admin Only Uploads" };
  }

  return hasReachableEmail
    ? { key: "manual_email", label: "Admin Sent Form By Mail" }
    : { key: "admin_only", label: "Admin Only Uploads" };
}
