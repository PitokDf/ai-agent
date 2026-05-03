export const TOOLS = [
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Evaluate a mathematical expression. Supports arithmetic, trig, logarithms.",
      parameters: {
        type: "object",
        properties: {
          expression: { type: "string", description: 'Math expression, e.g. "2 + 2", "Math.sqrt(16)"' },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information. Returns titles, snippets, and URLs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: { type: "number", description: "Number of results (default 5, max 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "code_executor",
      description: "Execute JavaScript code in a sandboxed environment and return the result.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "JavaScript code to execute" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather and forecast for a city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name, e.g. 'Jakarta'" },
          days: { type: "number", description: "Forecast days (1-3, default 1)" },
        },
        required: ["city"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_price",
      description: "Get stock price and info for a symbol.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Stock symbol, e.g. 'AAPL', 'BBCA.JK'" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of an uploaded file.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Name of the file to read" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "datetime",
      description: "Get current date and time, or format/convert a datetime string.",
      parameters: {
        type: "object",
        properties: {
          timezone: { type: "string", description: "IANA timezone, e.g. 'Asia/Jakarta'. Defaults to local." },
          format: { type: "string", description: "Optional: 'iso' | 'locale' | 'unix'. Default: 'locale'." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_url",
      description: "Fetch the text content of a public URL (webpage, API, etc.).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          selector: { type: "string", description: "Optional CSS selector to extract specific content" },
        },
        required: ["url"],
      },
    },
  },
];

export function getAllTools(customTools = []) {
  return [
    ...TOOLS,
    ...customTools.map((t) => ({
      type: "function",
      function: {
        name: t.name.replace(/\s+/g, "_").toLowerCase(),
        description: t.description,
        parameters: {
          type: "object",
          properties: t.parameters || {},
          required: t.required || [],
        },
      },
    })),
  ];
}

export async function executeTool(name, args, uploadedFiles = {}, searchConfig = {}, customTools = []) {
  const custom = customTools.find(
    (t) => t.name.replace(/\s+/g, "_").toLowerCase() === name
  );
  if (custom) return runCustomTool(custom, args);

  switch (name) {
    case "calculator": return runCalculator(args.expression);
    case "web_search": return runWebSearch(args.query, args.count, searchConfig);
    case "code_executor": return runCodeExecutor(args.code);
    case "read_file": return runFileReader(args.filename, uploadedFiles);
    case "get_weather": return runWeather(args.city, args.days);
    case "get_stock_price": return runStock(args.symbol);
    case "datetime": return runDatetime(args.timezone, args.format);
    case "fetch_url": return runFetchUrl(args.url, args.selector);
    default: return { error: `Unknown tool: "${name}". Available: ${TOOLS.map(t => t.function.name).join(", ")}` };
  }
}

function runCustomTool(tool, args) {
  if (tool.implementation) {
    try {
      const fn = new Function("args", `"use strict"; ${tool.implementation}`);
      const result = fn(args);
      return { result, tool: tool.name };
    } catch (err) {
      return { error: err.message, tool: tool.name };
    }
  }
  return { result: args, note: "Custom tool invoked (no implementation provided)", tool: tool.name };
}

function runCalculator(expression) {
  try {
    // Allow digits, operators, parens, dots, spaces, commas, and all letters/underscores
    // for Math.* function names. Scope-limited to only Math via new Function param.
    const sanitized = expression.replace(/[^0-9+\-*/.%^()\s,a-zA-Z_]/g, "");
    // eslint-disable-next-line no-new-func
    const result = new Function("Math", `"use strict"; return (${sanitized})`)(Math);
    if (result === undefined || result === null || Number.isNaN(result)) throw new Error("Invalid result");
    return { result: String(result), expression };
  } catch (err) {
    return { error: err.message, expression };
  }
}

async function runWebSearch(query, count = 5, config = {}) {
  const n = Math.min(count || 5, 10);
  const { searchProvider = "none", searchApiKey = "" } = config;

  if (searchProvider === "brave" && searchApiKey) return searchBrave(query, searchApiKey, n);
  if (searchProvider === "serper" && searchApiKey) return searchSerper(query, searchApiKey, n);
  if (searchProvider === "tavily" && searchApiKey) return searchTavily(query, searchApiKey, n);
  if (searchProvider === "duckduckgo") return searchDDG(query, n);

  return {
    error: "No search provider configured.",
    hint: "Settings → Search tab. Options: Brave (brave.com/search/api), Serper (serper.dev), Tavily (tavily.com), or DuckDuckGo (free, no key).",
    query,
  };
}

async function searchBrave(query, apiKey, count) {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&text_decorations=false`,
    { headers: { Accept: "application/json", "X-Subscription-Token": apiKey }, signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`Brave API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    results: (data.web?.results || []).slice(0, count).map((r) => ({ title: r.title, snippet: r.description, url: r.url })),
    query, provider: "Brave Search",
  };
}

async function searchSerper(query, apiKey, count) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: count }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Serper API ${res.status}`);
  const data = await res.json();
  const results = [];
  if (data.answerBox?.answer) results.push({ title: "Direct Answer", snippet: data.answerBox.answer, url: "" });
  (data.organic || []).slice(0, count).forEach((r) => results.push({ title: r.title, snippet: r.snippet, url: r.link }));
  return { results, query, provider: "Serper (Google)" };
}

async function searchTavily(query, apiKey, count) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, max_results: count, include_answer: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Tavily API ${res.status}`);
  const data = await res.json();
  const results = [];
  if (data.answer) results.push({ title: "AI Answer", snippet: data.answer, url: "" });
  (data.results || []).forEach((r) => results.push({ title: r.title, snippet: r.content?.slice(0, 300), url: r.url }));
  return { results, query, provider: "Tavily" };
}

async function searchDDG(query, count) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`DDG ${res.status}`);
    const data = await res.json();
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || "Summary", snippet: data.AbstractText, url: data.AbstractURL || "" });
    (data.RelatedTopics || []).slice(0, count - 1).forEach((t) => {
      if (t.Text) results.push({ title: t.Text.slice(0, 60), snippet: t.Text, url: t.FirstURL || "" });
    });
    return { results: results.length ? results : [{ title: "No results", snippet: "DuckDuckGo found no instant answers. Try a different query or configure a search API.", url: "" }], query, provider: "DuckDuckGo" };
  } catch (err) {
    return { error: err.message, query };
  }
}

async function runWeather(city, days = 1) {
  const d = Math.min(Math.max(days || 1, 1), 3);
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Weather service unavailable");
  const data = await res.json();
  const current = data.current_condition[0];
  const nearest = data.nearest_area[0];
  const forecast = data.weather.slice(0, d).map((w) => ({
    date: w.date,
    maxC: w.maxtempC, minC: w.mintempC,
    description: w.hourly[4]?.weatherDesc[0]?.value,
    chanceOfRain: w.hourly[4]?.chanceofrain,
  }));
  return {
    type: "weather",
    city: city.charAt(0).toUpperCase() + city.slice(1),
    area: nearest.areaName[0].value,
    country: nearest.country[0].value,
    temp: current.temp_C, tempUnit: "°C",
    condition: current.weatherDesc[0].value,
    humidity: current.humidity,
    wind: current.windspeedKmph, windUnit: "km/h",
    feelsLike: current.FeelsLikeC,
    forecast: d > 1 ? forecast : undefined,
  };
}

async function runStock(symbol) {
  const sym = symbol.toUpperCase();
  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yahoo-finance`;
  try {
    const res = await fetch(
      `${proxyUrl}?symbol=${encodeURIComponent(sym)}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (res.ok) {
      const data = await res.json();
      const meta = data.chart?.result?.[0]?.meta;
      if (meta) {
        return {
          type: "stock",
          symbol: sym,
          name: meta.shortName || sym,
          price: meta.regularMarketPrice?.toFixed(2),
          previousClose: meta.chartPreviousClose?.toFixed(2),
          change: (meta.regularMarketPrice - meta.chartPreviousClose)?.toFixed(2),
          percent: (((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100)?.toFixed(2),
          currency: meta.currency,
          exchange: meta.exchangeName,
          timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
        };
      }
    }
  } catch (_) { }

  return {
    type: "stock",
    symbol: sym,
    error: "Could not fetch stock data. Check the symbol (e.g. BBCA.JK for IDX stocks, AAPL for US stocks).",
    timestamp: new Date().toISOString(),
  };
}

function runDatetime(timezone, format = "locale") {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();

    // Compute accurate UTC offset for the requested timezone
    const utcMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const localDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const utcOffset = (tzDate - localDate) / 3600000;

    const locale = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(now);

    return {
      iso: now.toISOString(),
      locale,
      unix: Math.floor(utcMs / 1000),
      timezone: tz,
      utcOffset,
    };
  } catch (err) {
    return { error: `Invalid timezone: ${timezone}`, iso: new Date().toISOString() };
  }
}

async function runFetchUrl(url, selector) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http/https URLs allowed");

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Agent/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const json = await res.json();
      return { url, contentType, data: json };
    }

    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 8000);

    return { url, contentType, text: stripped, truncated: text.length > 8000 };
  } catch (err) {
    return { error: err.message, url };
  }
}

function runCodeExecutor(code) {
  const logs = [];
  const sandbox = {
    console: {
      log: (...a) => logs.push(a.map((x) => typeof x === "object" ? JSON.stringify(x, null, 2) : String(x)).join(" ")),
      error: (...a) => logs.push("[error] " + a.map(String).join(" ")),
      warn: (...a) => logs.push("[warn] " + a.map(String).join(" ")),
      table: (x) => logs.push(JSON.stringify(x, null, 2)),
      info: (...a) => logs.push("[info] " + a.map(String).join(" ")),
    },
    Math, JSON, Date, parseInt, parseFloat, isNaN, isFinite,
    Array, Object, String, Number, Boolean, Set, Map, Promise,
    setTimeout: () => { throw new Error("setTimeout not allowed in sandbox"); },
    fetch: () => { throw new Error("fetch not allowed in sandbox; use the fetch_url tool instead"); },
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(...Object.keys(sandbox), `"use strict";\n${code}`);
    const ret = fn(...Object.values(sandbox));
    return {
      output: logs.join("\n") || null,
      returnValue: ret !== undefined ? (typeof ret === "object" ? JSON.stringify(ret, null, 2) : String(ret)) : null,
      code,
    };
  } catch (err) {
    return { error: err.message, output: logs.join("\n") || null, code };
  }
}

function runFileReader(filename, uploadedFiles) {
  const file = uploadedFiles[filename];
  if (!file) {
    const available = Object.keys(uploadedFiles);
    return {
      error: `File "${filename}" not found.`,
      availableFiles: available.length ? available : ["No files uploaded"],
    };
  }
  return { filename, content: file.content, type: file.type, size: file.size };
}