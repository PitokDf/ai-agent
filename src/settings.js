const DEFAULTS = {
  provider: 'ollama',
  apiUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'gemma3:4b',
  systemPrompt: 'You are a helpful AI assistant with access to tools. Use them when appropriate to give accurate, up-to-date answers.',
  temperature: 0.7,
  maxTokens: 4096,
  contextWindowTokens: 8000,   // max tokens to keep in context before trimming
  streamingEnabled: true,
  // Search
  searchProvider: 'none',      // 'none' | 'brave' | 'serper' | 'tavily' | 'duckduckgo'
  searchApiKey: '',
  // Custom tools
  customTools: [],
  // Skills
  skills: [],
  activeSkills: [],
  // Provider configs (per-provider settings)
  providerConfigs: {
    ollama:      { apiUrl: 'http://localhost:11434',                           apiKey: '',  model: 'gemma3:4b' },
    lmstudio:    { apiUrl: 'http://localhost:1234/v1',                         apiKey: 'lm-studio', model: 'local-model' },
    jan:         { apiUrl: 'http://localhost:1337/v1',                         apiKey: '',  model: 'local-model' },
    openai:      { apiUrl: 'https://api.openai.com/v1',                       apiKey: '',  model: 'gpt-4o-mini' },
    anthropic:   { apiUrl: 'https://api.anthropic.com/v1',                    apiKey: '',  model: 'claude-3-5-haiku-20241022' },
    google:      { apiUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '',  model: 'gemini-2.0-flash' },
    groq:        { apiUrl: 'https://api.groq.com/openai/v1',                  apiKey: '',  model: 'llama-3.3-70b-versatile' },
    openrouter:  { apiUrl: 'https://openrouter.ai/api/v1',                    apiKey: '',  model: 'google/gemini-flash-1.5' },
    mistral:     { apiUrl: 'https://api.mistral.ai/v1',                       apiKey: '',  model: 'mistral-small-latest' },
    deepseek:    { apiUrl: 'https://api.deepseek.com/v1',                     apiKey: '',  model: 'deepseek-chat' },
    xai:         { apiUrl: 'https://api.x.ai/v1',                             apiKey: '',  model: 'grok-3-mini' },
    together:    { apiUrl: 'https://api.together.xyz/v1',                     apiKey: '',  model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
    perplexity:  { apiUrl: 'https://api.perplexity.ai',                       apiKey: '',  model: 'sonar' },
    cloudflare:  { apiUrl: 'https://api.cloudflare.com/client/v4',            apiKey: '',  model: '@cf/meta/llama-3-8b-instruct', accountId: '' },
  },
}

const KEY = 'ai-agent-settings'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const stored = JSON.parse(raw)
    // Deep merge providerConfigs
    return {
      ...DEFAULTS,
      ...stored,
      providerConfigs: {
        ...DEFAULTS.providerConfigs,
        ...(stored.providerConfigs || {}),
      },
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
}

export { DEFAULTS }

// ─── API provider metadata ────────────────────────────────────────────────────

export const API_PROVIDERS = [
  // Local
  { value: 'ollama',     label: 'Ollama',          group: 'Local',   url: 'https://ollama.ai', note: 'Free, local' },
  { value: 'lmstudio',   label: 'LM Studio',       group: 'Local',   url: 'https://lmstudio.ai', note: 'Free, local' },
  { value: 'jan',        label: 'Jan',              group: 'Local',   url: 'https://jan.ai', note: 'Free, local' },
  // Cloud
  { value: 'openai',     label: 'OpenAI',           group: 'Cloud',   url: 'https://platform.openai.com' },
  { value: 'anthropic',  label: 'Anthropic (Claude)', group: 'Cloud', url: 'https://console.anthropic.com' },
  { value: 'google',     label: 'Google (Gemini)',  group: 'Cloud',   url: 'https://aistudio.google.com' },
  { value: 'groq',       label: 'Groq',             group: 'Cloud',   url: 'https://console.groq.com', note: 'Fast inference' },
  { value: 'openrouter', label: 'OpenRouter',       group: 'Cloud',   url: 'https://openrouter.ai', note: 'Multi-model' },
  { value: 'mistral',    label: 'Mistral',          group: 'Cloud',   url: 'https://console.mistral.ai' },
  { value: 'deepseek',   label: 'DeepSeek',         group: 'Cloud',   url: 'https://platform.deepseek.com', note: 'Affordable' },
  { value: 'xai',        label: 'xAI (Grok)',       group: 'Cloud',   url: 'https://console.x.ai' },
  { value: 'together',   label: 'Together AI',      group: 'Cloud',   url: 'https://api.together.xyz', note: 'Many OSS models' },
  { value: 'perplexity', label: 'Perplexity',       group: 'Cloud',   url: 'https://www.perplexity.ai', note: 'Search-augmented (no tools)' },
  { value: 'cloudflare', label: 'Cloudflare AI',    group: 'Cloud',   url: 'https://developers.cloudflare.com/workers-ai', note: 'No tools' },
]

export const CLOUDFLARE_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3-8b-instruct',
  '@cf/meta/llama-3-70b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.1',
  '@cf/google/gemma-7b-it',
  '@cf/qwen/qwen1.5-7b-chat-awq',
  '@cf/microsoft/phi-2',
]

// ─── Built-in skills ──────────────────────────────────────────────────────────

export const BUILTIN_SKILLS = [
  {
    id: 'coding',
    name: 'Coding Assistant',
    icon: 'Code',
    description: 'Expert programmer. Prefers clean, production-ready code with explanations.',
    instructions: 'You are an expert software engineer. Always write clean, production-ready code. Explain your reasoning. Prefer modern best practices. When writing code, include type hints, error handling, and brief comments for complex logic.',
    builtin: true,
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    icon: 'Database',
    description: 'Analyzes data, writes analysis scripts, interprets results.',
    instructions: 'You are a data analyst expert. When analyzing data, provide statistical insights, identify patterns, and suggest visualizations. Use the code executor tool to run calculations. Always interpret results in plain language.',
    builtin: true,
  },
  {
    id: 'researcher',
    name: 'Web Researcher',
    icon: 'Search',
    description: 'Actively searches the web to answer questions with current info.',
    instructions: 'You are a research assistant. Always use the web_search tool to find current, accurate information before answering factual questions. Cite your sources. Summarize findings clearly.',
    builtin: true,
  },
  {
    id: 'writer',
    name: 'Writer',
    icon: 'PenTool',
    description: 'Helps with writing, editing, and content creation.',
    instructions: "You are an expert writer and editor. Help with drafting, editing, and improving written content. Match the user's requested tone and style. Provide constructive feedback when reviewing text.",
    builtin: true,
  },
  {
    id: 'math',
    name: 'Math Tutor',
    icon: 'Calculator',
    description: 'Solves math problems step-by-step, uses calculator for verification.',
    instructions: 'You are a math tutor. Always show your work step-by-step. Use the calculator tool to verify numerical results. Explain concepts clearly and check your answers.',
    builtin: true,
  },
]
