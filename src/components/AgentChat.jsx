import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function AgentChat() {
  const { askAgent, agentLogs } = useApp();
  const [message, setMessage] = useState("Show pending enrollments.");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || loading) return;

    setLoading(true);
    setError("");

    try {
      const nextResponse = await askAgent(trimmedMessage);
      setResponse(nextResponse);
      setMessage("");
    } catch (agentError) {
      setError(agentError.message || "Unable to complete the agent workflow right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="panel p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-accent-600">AI Enrollment Agent</p>
            <h3 className="mt-2 font-display text-3xl font-bold text-slate-900">Ask for guidance, status, and next actions</h3>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <textarea
            rows="5"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Example: I want to enroll in Agentic AI course."
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <button type="submit" className="button-primary" disabled={loading}>
            {loading ? "Running..." : "Run Agent Workflow"}
          </button>
        </form>
        <div className="panel-muted mt-6 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest response</p>
          {response ? (
            <>
              <p className="mt-3 text-slate-800">{response.reply}</p>
              <p className="mt-4 text-sm text-accent-700">Next action: {response.nextAction}</p>
              <p className="mt-1 text-sm text-slate-600">Readiness: {response.readiness}</p>
            </>
          ) : (
            <p className="mt-3 text-slate-600">The agent will analyze context and recommend the next best enrollment action.</p>
          )}
        </div>
      </div>
      <div className="panel p-6">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Agent Log</p>
        <div className="mt-5 space-y-4">
          {agentLogs.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-accent-700">User: {item.user_message}</p>
              <p className="mt-2 text-sm text-slate-700">Agent: {item.agent_response}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-500">Next: {item.next_action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
