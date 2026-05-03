import { getAllTools, executeTool } from "./tools.js";

const MAX_ROUNDS = 10;
const TOOL_TIMEOUT_MS = 20_000;
const NO_TOOLS = new Set(["cloudflare", "perplexity"]);

export function trimContext(messages, targetTokens = 8000) {
  const est = msgs => msgs.reduce((s, m) => s + Math.ceil((typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")).length / 4) + 4, 0);
  if (est(messages) <= targetTokens) return messages;
  const system = messages.find(m => m.role === "system");
  const rest = messages.filter(m => m.role !== "system");
  while (est([system, ...rest].filter(Boolean)) > targetTokens && rest.length > 2) {
    rest.shift();
    while (rest[0]?.role === "tool" || rest[0]?.role === "function") rest.shift();
  }
  return system ? [system, ...rest] : rest;
}

function toAnthropicMessages(history) {
  const out = [];
  for (const m of history) {
    if (m.role === "system") continue;
    if (m.tool_calls?.length) {
      const parts = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls) {
        parts.push({
          type: "tool_use", id: tc.id, name: tc.function.name,
          input: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments
        });
      }
      out.push({ role: "assistant", content: parts });
    } else if (m.role === "tool") {
      const block = { type: "tool_result", tool_use_id: m.tool_call_id, content: m.content };
      const last = out[out.length - 1];
      if (last?.role === "user" && Array.isArray(last.content)) last.content.push(block);
      else out.push({ role: "user", content: [block] });
    } else {
      out.push({ role: m.role === "model" ? "assistant" : m.role, content: m.content ?? "" });
    }
  }
  return out;
}

function toGoogleContents(history) {
  return history.filter(m => m.role !== "system").map(m => {
    if (m.role === "assistant" || m.role === "model") {
      const parts = [];
      if (m.content) parts.push({ text: m.content });
      if (m.tool_calls) m.tool_calls.forEach(tc => parts.push({
        functionCall: { name: tc.function.name, args: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments }
      }));
      return { role: "model", parts };
    }
    if (m.role === "tool" || m.role === "function") {
      return { role: "function", parts: [{ functionResponse: { name: m.name, response: { result: m.result ?? JSON.parse(m.content) } } }] };
    }
    return { role: "user", parts: [{ text: m.content ?? "" }] };
  });
}

function buildRequest(provider, config, history, tools, settings, stream) {
  if (provider === "ollama") {
    return {
      endpoint: `${config.apiUrl.replace(/\/$/, "")}/api/chat`,
      headers: { "Content-Type": "application/json", ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
      body: {
        model: config.model,
        messages: history.map(m => ({ role: m.role, content: m.content ?? "", tool_calls: m.tool_calls || undefined, tool_call_id: m.tool_call_id || undefined })),
        tools: tools.length ? tools : undefined,
        stream,
        options: { temperature: settings.temperature, num_predict: settings.maxTokens },
      },
    };
  }
  if (provider === "anthropic") {
    const system = history.find(m => m.role === "system")?.content ?? "";
    return {
      endpoint: `${config.apiUrl.replace(/\/$/, "")}/messages`,
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "dangerously-allow-browser": "true" },
      body: {
        model: config.model, messages: toAnthropicMessages(history),
        system: system || undefined, max_tokens: settings.maxTokens, stream, temperature: settings.temperature,
        tools: tools.length ? tools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) : undefined,
      },
    };
  }
  if (provider === "google") {
    const method = stream ? "streamGenerateContent" : "generateContent";
    const system = history.find(m => m.role === "system")?.content;
    return {
      endpoint: `${config.apiUrl.replace(/\/$/, "")}/models/${config.model}:${method}${stream ? "?alt=sse" : ""}`,
      headers: { "Content-Type": "application/json", "X-goog-api-key": config.apiKey },
      body: {
        contents: toGoogleContents(history),
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        tools: tools.length ? [{ function_declarations: tools.map(t => t.function) }] : undefined,
        generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxTokens },
      },
    };
  }
  if (provider === "cloudflare") {
    return {
      endpoint: `${config.apiUrl.replace(/\/$/, "")}/accounts/${config.accountId}/ai/run/${config.model}`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: { messages: history.map(m => ({ role: m.role, content: m.content ?? "" })), max_tokens: settings.maxTokens, stream: false },
    };
  }
  return {
    endpoint: `${config.apiUrl.replace(/\/$/, "")}/chat/completions`,
    headers: {
      "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}`,
      ...(provider === "openrouter" ? { "HTTP-Referer": "https://ai-agent.local", "X-Title": "AI Agent" } : {}),
    },
    body: {
      model: config.model,
      messages: history.map(m => ({ role: m.role === "model" ? "assistant" : m.role, content: m.content ?? "", ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}), ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}), ...(m.name ? { name: m.name } : {}) })),
      tools: tools.length ? tools : undefined, stream, temperature: settings.temperature, max_tokens: settings.maxTokens,
    },
  };
}

function mergeOpenAIToolDelta(acc, deltas) {
  for (const d of deltas) {
    const i = d.index ?? 0;
    if (!acc[i]) acc[i] = { id: "", function: { name: "", arguments: "" } };
    if (d.id) acc[i].id = d.id;
    if (d.function?.name) acc[i].function.name += d.function.name;
    if (d.function?.arguments) acc[i].function.arguments += d.function.arguments;
  }
}

async function processStream(provider, reader, onToken, onThinkingToken) {
  const decoder = new TextDecoder();
  let buf = "", content = "", thinking = "", inThink = false;
  const toolAcc = {}, anthropicBlocks = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t || t === "data: [DONE]" || t === "event: ping") continue;
      try {
        if (provider === "ollama") {
          const d = JSON.parse(t);
          if (d.message?.thinking) { thinking += d.message.thinking; onThinkingToken?.(d.message.thinking); }
          if (d.message?.tool_calls) d.message.tool_calls.forEach((tc, i) => { toolAcc[i] = tc; });
          const chunk = d.message?.content || "";
          if (chunk) {
            const r = parseThink(chunk, inThink);
            inThink = r.inThink;
            if (r.th) { thinking += r.th; onThinkingToken?.(r.th); }
            if (r.ct) { content += r.ct; onToken(r.ct); }
          }
        } else if (provider === "anthropic") {
          if (!t.startsWith("data: ")) continue;
          const d = JSON.parse(t.slice(6));
          if (d.type === "content_block_start") {
            const b = d.content_block;
            anthropicBlocks[d.index] = { type: b.type, text: "", thinking: "", name: b.name, id: b.id, input: "" };
          } else if (d.type === "content_block_delta") {
            const b = anthropicBlocks[d.index];
            if (!b) continue;
            if (d.delta.type === "text_delta") { b.text += d.delta.text; content += d.delta.text; onToken(d.delta.text); }
            else if (d.delta.type === "thinking_delta") { b.thinking += d.delta.thinking; thinking += d.delta.thinking; onThinkingToken?.(d.delta.thinking); }
            else if (d.delta.type === "input_json_delta") b.input += d.delta.partial_json;
          } else if (d.type === "content_block_stop") {
            const b = anthropicBlocks[d.index];
            if (b?.type === "tool_use") toolAcc[Object.keys(toolAcc).length] = { id: b.id, function: { name: b.name, arguments: b.input } };
          }
        } else if (provider === "google") {
          if (!t.startsWith("data: ")) continue;
          const d = JSON.parse(t.slice(6));
          for (const p of d.candidates?.[0]?.content?.parts || []) {
            if (p.text) { content += p.text; onToken(p.text); }
            if (p.functionCall) toolAcc[Object.keys(toolAcc).length] = { id: `call_${Date.now()}_${Object.keys(toolAcc).length}`, function: { name: p.functionCall.name, arguments: p.functionCall.args } };
          }
        } else {
          if (!t.startsWith("data: ")) continue;
          const d = JSON.parse(t.slice(6));
          const delta = d.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            const r = parseThink(delta.content, inThink);
            inThink = r.inThink;
            if (r.th) { thinking += r.th; onThinkingToken?.(r.th); }
            if (r.ct) { content += r.ct; onToken(r.ct); }
          }
          if (delta.tool_calls?.length) mergeOpenAIToolDelta(toolAcc, delta.tool_calls);
        }
      } catch (e) {
        console.warn("Stream parse error:", e);
      }
    }
  }

  const toolCalls = Object.values(toolAcc);
  return { content, thinking: thinking || undefined, toolCalls: toolCalls.length ? toolCalls : undefined };
}

function parseNonStream(provider, data) {
  if (provider === "ollama") {
    return { content: data.message?.content ?? "", toolCalls: data.message?.tool_calls?.length ? data.message.tool_calls : undefined, thinking: data.message?.thinking };
  }
  if (provider === "anthropic") {
    const blocks = data.content || [];
    return {
      content: blocks.filter(b => b.type === "text").map(b => b.text).join(""),
      thinking: blocks.filter(b => b.type === "thinking").map(b => b.thinking).join("") || undefined,
      toolCalls: blocks.filter(b => b.type === "tool_use").map(b => ({ id: b.id, function: { name: b.name, arguments: b.input } })),
    };
  }
  if (provider === "google") {
    const parts = data.candidates?.[0]?.content?.parts || [];
    return {
      content: parts.filter(p => p.text).map(p => p.text).join(""),
      toolCalls: parts.filter(p => p.functionCall).map((p, i) => ({ id: `call_${Date.now()}_${i}`, function: { name: p.functionCall.name, arguments: p.functionCall.args } })),
    };
  }
  if (provider === "cloudflare") return { content: data.result?.response ?? "" };
  const msg = data.choices?.[0]?.message;
  return { content: msg?.content ?? "", toolCalls: msg?.tool_calls?.length ? msg.tool_calls : undefined };
}

function formatToolResult(result) {
  if (result.error) return `Error: ${result.error}`;
  if (result.type === "weather") {
    return `Weather in ${result.city}: ${result.temp}°C, ${result.condition}, humidity ${result.humidity}%, wind ${result.wind} km/h, feels like ${result.feelsLike}°C`;
  }
  if (result.type === "stock") return `${result.symbol} (${result.name}): ${result.price} ${result.currency}, change: ${result.change} (${result.percent}%)`;
  if (result.results) return result.results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`).join("\n\n");
  if (result.returnValue !== undefined || result.output != null) return [result.output, result.returnValue !== null ? `=> ${result.returnValue}` : null].filter(Boolean).join("\n");
  if (result.content !== undefined) return String(result.content).slice(0, 4000);
  if (result.text) return result.text.slice(0, 4000);
  return JSON.stringify(result, null, 2).slice(0, 2000);
}

async function execTool(name, args, uploadedFiles, searchConfig, customTools) {
  return Promise.race([
    executeTool(name, args, uploadedFiles, searchConfig, customTools),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Tool "${name}" timed out`)), TOOL_TIMEOUT_MS)),
  ]).catch(err => ({ error: err.message, tool: name }));
}

export async function runAgentLoop({ messages, settings, uploadedFiles = {}, stagedFiles = [], onToken, onThinkingToken, onToolCall, onToolResult, onMessagesUpdate, onDone, onError, onStreamReset, signal }) {
  const { provider = "ollama", searchProvider, searchApiKey, customTools = [], streamingEnabled = true, contextWindowTokens = 8000 } = settings;
  const config = { ...(settings.providerConfigs?.[provider] || { apiUrl: settings.apiUrl, apiKey: settings.apiKey, model: settings.model }), provider };
  const searchConfig = { searchProvider, searchApiKey };
  const allTools = NO_TOOLS.has(provider) ? [] : getAllTools(customTools);
  let history = trimContext([...messages], contextWindowTokens);

  if (stagedFiles.length > 0) {
    const last = history[history.length - 1];
    if (last?.role === "user" && !last._filesInjected) {
      last.content += `\n\n[Attached files: ${stagedFiles.join(", ")}]`;
      last._filesInjected = true;
    }
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onStreamReset?.();
    const stream = streamingEnabled && provider !== "cloudflare";
    const req = buildRequest(provider, config, history, allTools, settings, stream);

    try {
      const res = await fetch(req.endpoint, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal });
      if (!res.ok) {
        let msg = `API Error: ${res.status}`;
        try { const e = await res.json(); msg = e.error?.message || e.message || e.detail || msg; } catch (_) { }
        throw new Error(msg);
      }

      let parsed;
      if (stream) parsed = await processStream(provider, res.body.getReader(), onToken, onThinkingToken);
      else { const data = await res.json(); parsed = parseNonStream(provider, data); }

      const { content, toolCalls, thinking } = parsed;
      history.push({ role: "assistant", content: content || "", thinking, tool_calls: toolCalls?.length ? toolCalls : undefined });
      onMessagesUpdate?.([...history]);

      if (!toolCalls?.length) { onDone?.(history); return; }

      for (const call of toolCalls) {
        let args = call.function.arguments;
        if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
        onToolCall?.({ id: call.id, name: call.function.name, args });

        const result = await execTool(call.function.name, args, uploadedFiles, searchConfig, customTools);
        call.result = result;
        call.status = result.error ? "error" : "done";
        onToolResult?.({ id: call.id, result });

        const readable = formatToolResult(result);
        if (provider === "google") history.push({ role: "function", content: readable, name: call.function.name, result });
        else history.push({ role: "tool", tool_call_id: call.id, content: readable, name: call.function.name });
        onMessagesUpdate?.([...history]);
      }

      history = trimContext(history, contextWindowTokens);
    } catch (err) {
      if (err.name === "AbortError") return;
      onError?.(err.message);
      return;
    }
  }
  onError?.(`Reached maximum tool rounds (${MAX_ROUNDS}).`);
}

function parseThink(chunk, inThink) {
  const S = "<think>", E = "</think>";
  let th = "", ct = "", i = 0;
  let newIn = inThink;
  while (i < chunk.length) {
    if (!newIn) {
      if (chunk.slice(i, i + S.length) === S) { newIn = true; i += S.length; }
      else ct += chunk[i++];
    } else {
      if (chunk.slice(i, i + E.length) === E) { newIn = false; i += E.length; }
      else { th += chunk[i++]; }
    }
  }
  return { th, ct, inThink: newIn };
}