import { useSearchParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import EnrollmentForm from "../components/EnrollmentForm";
import PageHeader from "../components/PageHeader";

export default function EnrollmentPageSimple() {
  const [searchParams] = useSearchParams();
  const convertEnrollmentId = searchParams.get("convert") || "";
  const returnPath = searchParams.get("from") === "enquiries" ? "/enquiries" : "";

  return (
    <AppShell>
      <PageHeader
        eyebrow={convertEnrollmentId ? "Complete Admission" : "New Enquiry"}
        title="Student Form"
        description=""
      />

      <EnrollmentForm convertEnrollmentId={convertEnrollmentId} returnPath={returnPath} />
    </AppShell>
  );
}
