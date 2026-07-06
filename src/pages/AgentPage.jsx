import AppShell from "../components/AppShell";
import AgentChat from "../components/AgentChat";
import PageHeader from "../components/PageHeader";

export default function AgentPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Agentic AI"
        title="AI enrollment agent"
        description="Ask for guidance and next actions."
      />
      <AgentChat />
    </AppShell>
  );
}
