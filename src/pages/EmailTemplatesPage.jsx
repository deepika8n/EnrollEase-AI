import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";

export default function EmailTemplatesPage() {
  const { emailTemplates, saveEmailTemplate } = useApp();
  const [draft, setDraft] = useState(emailTemplates[0]);

  useEffect(() => {
    if (!draft && emailTemplates.length) {
      setDraft(emailTemplates[0]);
    }
  }, [draft, emailTemplates]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Email center"
        title="Template management and trigger placeholders"
        description="Create and edit email copy for enrollment submission, approval, pending payment, missing documents, and completion workflows."
      />

      {!emailTemplates.length || !draft ? (
        <EmptyState
          title="No templates yet"
          description="Run the updated Supabase SQL again to insert the starter templates, or create your first template manually."
        />
      ) : (
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-6">
          <h2 className="section-title">Templates</h2>
          <div className="mt-5 space-y-3">
            {emailTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => setDraft(template)}
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left hover:bg-white"
              >
                <p className="font-semibold text-slate-900">{template.template_name}</p>
                <p className="mt-1 text-sm text-slate-500">{template.subject}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="section-title">Edit template</h2>
          <div className="mt-5 space-y-4">
            <input value={draft.template_name} onChange={(e) => setDraft((p) => ({ ...p, template_name: e.target.value }))} />
            <input value={draft.subject} onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))} />
            <textarea rows="10" value={draft.body} onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))} />
            <button type="button" className="button-primary" onClick={() => saveEmailTemplate(draft)}>
              Save template
            </button>
          </div>
        </div>
      </div>
      )}
    </AppShell>
  );
}
