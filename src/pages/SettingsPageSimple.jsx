import { useState } from "react";
import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import { useApp } from "../context/AppContext";

export default function SettingsPageSimple() {
  const { currentUser, demoMode, resetPassword } = useApp();
  const [form, setForm] = useState({
    email: currentUser?.email || "",
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await resetPassword(form);
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader eyebrow="Settings" title="Admin Security" description="" />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-6">
          <h2 className="section-title">Reset Password</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Admin email"
              required
            />
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              placeholder="Current password"
            />
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              placeholder="New password"
              required
            />
            <button type="submit" className="button-primary" disabled={saving}>
              {saving ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        <section className="panel p-6">
          <h2 className="section-title">Portal Info</h2>
          <div className="mt-6 space-y-4 text-sm text-slate-600">
            <p>Mode: {demoMode ? "Local demo mode" : "Supabase mode"}</p>
            {demoMode ? <p>Default admin login: `admin@enrollease.ai` / `Admin@123`</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
