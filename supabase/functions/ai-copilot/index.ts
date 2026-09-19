import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return reply(200, { ok: true });
  if (request.method !== "POST") return reply(405, { error: "POST required." });
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return reply(401, { error: "Sign in to use the AI assistant." });
  try {
    const body = await request.json();
    if (typeof body.prompt !== "string" || typeof body.system !== "string" ||
        !body.prompt.trim() || body.prompt.length + body.system.length > 200000) {
      return reply(400, { error: "Invalid or oversized AI request." });
    }
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const openaiKey = Deno.env.get("AI_API_KEY");
    if (!geminiKey && !openaiKey) return reply(503, { error: "AI provider is not configured." });
    const response = geminiKey
      ? await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash")}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          contents: [{ role: "user", parts: [{ text: `${body.system}\nReturn strict JSON only.\n\n${body.prompt}` }] }] }),
      })
      : await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({ model: Deno.env.get("AI_MODEL") || "gpt-4o-mini", temperature: 0.2,
          messages: [{ role: "system", content: `${body.system} Reply in strict JSON only.` }, { role: "user", content: body.prompt }] }),
      });
    if (!response.ok) return reply(response.status === 429 ? 429 : 502, { error: { code: response.status, message: response.status === 429 ? "AI rate limit reached." : "AI provider request failed. Check server configuration." } });
    const result = await response.json();
    const message = geminiKey ? result?.candidates?.[0]?.content?.parts?.map((part: {text?: string}) => part.text || "").join("\n") : result?.choices?.[0]?.message?.content;
    if (!message) return reply(502, { error: "AI response was empty." });
    return reply(200, { message });
  } catch {
    return reply(502, { error: "AI request could not be completed." });
  }
});
