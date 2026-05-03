import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CF_BASE = "https://api.cloudflare.com/client/v4";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/cloudflare-ai", "");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: GET /models — list text-generation models
    if (path === "/models" && req.method === "GET") {
      const accountId = url.searchParams.get("accountId");
      if (!accountId) {
        return new Response(JSON.stringify({ error: "Missing accountId parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfUrl = `${CF_BASE}/accounts/${accountId}/ai/models/search?task=Text Generation`;
      const cfRes = await fetch(cfUrl, {
        headers: { Authorization: authHeader },
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return new Response(JSON.stringify({ error: `Cloudflare API error: ${cfRes.status}`, details: errText }), {
          status: cfRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await cfRes.json();
      const models = (data.result || []).map((m: any) => m.id || m.name);
      models.sort();

      return new Response(JSON.stringify({ data: models }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: POST /chat — OpenAI-compatible chat completions
    if (path === "/chat" && req.method === "POST") {
      const body = await req.json();
      const { accountId, ...chatBody } = body;

      if (!accountId) {
        return new Response(JSON.stringify({ error: "Missing accountId in request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfUrl = `${CF_BASE}/accounts/${accountId}/ai/v1/chat/completions`;
      const cfRes = await fetch(cfUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chatBody),
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return new Response(JSON.stringify({ error: `Cloudflare API error: ${cfRes.status}`, details: errText }), {
          status: cfRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if streaming
      if (chatBody.stream) {
        // Forward SSE stream
        const reader = cfRes.body?.getReader();
        if (!reader) {
          return new Response(JSON.stringify({ error: "No response body" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(
          new ReadableStream({
            async pull(controller) {
              const decoder = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.close();
                    return;
                  }
                  controller.enqueue(value);
                }
              } catch (err) {
                controller.error(err);
              }
            },
            cancel() {
              reader.cancel();
            },
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          }
        );
      }

      // Non-streaming: forward JSON
      const data = await cfRes.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route: POST /run — legacy /ai/run/{model} endpoint
    if (path === "/run" && req.method === "POST") {
      const body = await req.json();
      const { accountId, model, ...runBody } = body;

      if (!accountId || !model) {
        return new Response(JSON.stringify({ error: "Missing accountId or model" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfUrl = `${CF_BASE}/accounts/${accountId}/ai/run/${model}`;
      const cfRes = await fetch(cfUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(runBody),
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        return new Response(JSON.stringify({ error: `Cloudflare API error: ${cfRes.status}`, details: errText }), {
          status: cfRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await cfRes.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found. Use /models, /chat, or /run" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
