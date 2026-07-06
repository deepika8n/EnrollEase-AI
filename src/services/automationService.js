const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

export async function triggerAutomation(flowName, payload) {
  if (!webhookUrl) {
    return {
      success: true,
      mode: "placeholder",
      message: `Automation placeholder triggered for ${flowName}. Add VITE_N8N_WEBHOOK_URL to enable n8n.`,
      payload,
    };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flowName, payload }),
    });

    return response.json();
  } catch (error) {
    return {
      success: false,
      mode: "n8n-unreachable",
      message: `n8n webhook could not be reached for ${flowName}.`,
      error: error.message,
    };
  }
}
