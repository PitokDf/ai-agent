import { useState, useEffect } from 'react'
import { X, Trash2, Settings2, RefreshCw, CircleAlert as AlertCircle, ExternalLink } from 'lucide-react'
import { saveSettings, API_PROVIDERS } from '../settings.js'

const EMPTY_TOOL = { name: '', description: '', parameters: {}, required: [] }

const SEARCH_PROVIDERS = [
  { value: 'none',       label: 'None (disabled)' },
  { value: 'duckduckgo', label: 'DuckDuckGo',       url: 'https://duckduckgo.com', free: 'Free, no key' },
  { value: 'brave',      label: 'Brave Search',      url: 'https://brave.com/search/api/', free: '2,000 req/mo free' },
  { value: 'serper',     label: 'Serper (Google)',    url: 'https://serper.dev', free: '2,500 req free' },
  { value: 'tavily',     label: 'Tavily',             url: 'https://tavily.com', free: '1,000 req/mo free' },
]

// Providers where tool calling is not supported
const NO_TOOLS_PROVIDERS = new Set(['cloudflare', 'perplexity'])

export default function SettingsModal({ settings, onUpdate, onClose }) {
  const [local, setLocal] = useState({ ...settings })
  const [tab, setTab] = useState('connection')
  const [models, setModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState(null)

  const activeProvider = local.provider || 'ollama'
  const providerMeta = API_PROVIDERS.find(p => p.value === activeProvider) || {}
  const config = local.providerConfigs?.[activeProvider] || { apiUrl: '', apiKey: '', model: '' }

  const set = (key, val) => setLocal(p => ({ ...p, [key]: val }))

  const setConfig = (key, val) => {
    setLocal(p => ({
      ...p,
      providerConfigs: {
        ...p.providerConfigs,
        [activeProvider]: { ...p.providerConfigs?.[activeProvider], [key]: val }
      }
    }))
  }

  // Sync top-level legacy fields when provider changes
  useEffect(() => {
    const cfg = local.providerConfigs?.[activeProvider] || {}
    setLocal(p => ({ ...p, apiUrl: cfg.apiUrl || '', apiKey: cfg.apiKey || '', model: cfg.model || '' }))
    fetchModels()
  }, [activeProvider])

  async function fetchModels() {
    setModels([])
    setModelError(null)
    if (!config.apiUrl) return
    setLoadingModels(true)
    try {
      if (activeProvider === 'cloudflare') {
        if (!config.accountId || !config.apiKey) { setLoadingModels(false); return }
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudflare-ai/models`
        const res = await fetch(`${proxyUrl}?accountId=${encodeURIComponent(config.accountId)}`, {
          headers: { Authorization: `Bearer ${config.apiKey}` },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) throw new Error(`Cloudflare: ${res.status}`)
        const data = await res.json()
        setModels(data.data || [])
        return
      }
      if (activeProvider === 'lmstudio' || activeProvider === 'jan') {
        // Local OpenAI-compat, no auth needed
        const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(4000) })
        if (!res.ok) throw new Error(`${res.status}`)
        const data = await res.json()
        setModels((data.data || []).map(m => m.id))
        return
      }
      if (activeProvider === 'ollama') {
        const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(4000) })
        if (!res.ok) throw new Error(`Ollama: ${res.status}`)
        const data = await res.json()
        setModels((data.models || []).map(m => m.name))
        return
      }
      if (activeProvider === 'google') {
        if (!config.apiKey) return
        const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/models?key=${config.apiKey}`, { signal: AbortSignal.timeout(6000) })
        if (!res.ok) throw new Error(`Google: ${res.status}`)
        const data = await res.json()
        setModels((data.models || []).filter(m => m.supportedGenerationMethods?.includes('generateContent')).map(m => m.name.replace('models/', '')))
        return
      }
      if (!config.apiKey) return
      // OpenAI-compatible (openai, groq, openrouter, mistral, deepseek, xai, together, perplexity)
      const res = await fetch(`${config.apiUrl.replace(/\/$/, '')}/models`, {
        headers: { Authorization: `Bearer ${config.apiKey}` },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) throw new Error(`API: ${res.status}`)
      const data = await res.json()
      setModels((data.data || []).map(m => m.id).sort())
    } catch (err) {
      setModelError(err.message)
    } finally {
      setLoadingModels(false)
    }
  }

  function handleSave() {
    const updated = {
      ...local,
      // Keep top-level fields in sync with active provider config
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      model: config.model,
    }
    saveSettings(updated)
    onUpdate(updated)
    onClose()
  }

  const tabs = ['connection', 'model', 'memory', 'search', 'tools']

  // Group providers for optgroup rendering
  const localProviders = API_PROVIDERS.filter(p => p.group === 'Local')
  const cloudProviders = API_PROVIDERS.filter(p => p.group === 'Cloud')

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings2 size={15} color='var(--text-2)' />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Settings</span>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={15} /></button>
        </div>

        <div style={tabBar}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ ...tabBtn, ...(tab === t ? tabActive : {}) }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div style={body}>

          {/* ── CONNECTION ── */}
          {tab === 'connection' && (
            <div style={fields}>
              <Field label='Provider'>
                <select style={inp} value={activeProvider} onChange={e => set('provider', e.target.value)}>
                  <optgroup label='Local'>
                    {localProviders.map(p => <option key={p.value} value={p.value}>{p.label}{p.note ? ` — ${p.note}` : ''}</option>)}
                  </optgroup>
                  <optgroup label='Cloud'>
                    {cloudProviders.map(p => <option key={p.value} value={p.value}>{p.label}{p.note ? ` — ${p.note}` : ''}</option>)}
                  </optgroup>
                </select>
              </Field>

              {providerMeta.url && (
                <a href={providerMeta.url} target='_blank' rel='noreferrer'
                  style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={10} /> {providerMeta.url}
                </a>
              )}

              <Field label='Base URL'>
                <input style={inp} value={config.apiUrl} onChange={e => setConfig('apiUrl', e.target.value)}
                  placeholder='https://api.example.com/v1' />
              </Field>

              {activeProvider !== 'ollama' && activeProvider !== 'lmstudio' && activeProvider !== 'jan' && (
                <Field label='API Key'>
                  <input style={inp} type='password' value={config.apiKey} onChange={e => setConfig('apiKey', e.target.value)}
                    placeholder={activeProvider === 'cloudflare' ? 'CF API Token (cfut_...)' : 'sk-...'} />
                </Field>
              )}

              {activeProvider === 'cloudflare' && (
                <Field label='Account ID'>
                  <input style={inp} value={config.accountId || ''} onChange={e => setConfig('accountId', e.target.value)}
                    placeholder='a606b22a8d...' />
                </Field>
              )}

              {NO_TOOLS_PROVIDERS.has(activeProvider) && (
                <div style={infoBox}>
                  <AlertCircle size={13} />
                  <span><strong>{providerMeta.label}</strong> does not support function calling. Tools will be disabled.</span>
                </div>
              )}

              {activeProvider === 'ollama' && modelError?.includes('fetch') && (
                <div style={warnBox}>
                  <AlertCircle size={13} />
                  <div>
                    <strong>CORS Error</strong> — Ollama blocks browser requests by default.<br />
                    Fix: set <code>OLLAMA_ORIGINS="*"</code> and restart Ollama.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODEL ── */}
          {tab === 'model' && (
            <div style={fields}>
              <Field label='Model'>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select style={{ ...inp, flex: 1 }} value={config.model}
                    onChange={e => setConfig('model', e.target.value)} disabled={loadingModels}>
                    {!models.includes(config.model) && <option value={config.model}>{config.model || '— select —'}</option>}
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={fetchModels} style={refreshBtn} title='Refresh model list'>
                    <RefreshCw size={13} style={loadingModels ? { animation: 'spin 1s linear infinite' } : {}} />
                  </button>
                </div>
                {modelError && <div style={{ fontSize: 11, color: 'var(--danger, #ef4444)', marginTop: 3 }}>{modelError}</div>}
                {/* Allow manual model name entry */}
                <input style={{ ...inp, marginTop: 6 }} value={config.model}
                  onChange={e => setConfig('model', e.target.value)}
                  placeholder='Or type model name manually' />
              </Field>

              <Field label='System Prompt'>
                <textarea style={{ ...textarea, height: 120 }} value={local.systemPrompt}
                  onChange={e => set('systemPrompt', e.target.value)} />
              </Field>

              <div style={sliderGrid}>
                <Field label={`Temperature: ${local.temperature}`}>
                  <input type='range' min={0} max={2} step={0.05} value={local.temperature}
                    onChange={e => set('temperature', parseFloat(e.target.value))} style={slider} />
                </Field>
                <Field label={`Max Output: ${local.maxTokens}`}>
                  <input type='range' min={256} max={32768} step={256} value={local.maxTokens}
                    onChange={e => set('maxTokens', parseInt(e.target.value))} style={slider} />
                </Field>
              </div>

              <Field label='Streaming'>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type='checkbox' checked={local.streamingEnabled}
                    onChange={e => set('streamingEnabled', e.target.checked)} />
                  Enable streaming (token-by-token output)
                </label>
              </Field>
            </div>
          )}

          {/* ── MEMORY ── */}
          {tab === 'memory' && (
            <div style={fields}>
              <Field label={`Context Window: ~${local.contextWindowTokens} tokens`}
                hint='Older messages are trimmed when exceeded'>
                <input type='range' min={2000} max={64000} step={1000} value={local.contextWindowTokens || 8000}
                  onChange={e => set('contextWindowTokens', parseInt(e.target.value))} style={slider} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                  <span>2K (fast)</span><span>8K (default)</span><span>64K (long)</span>
                </div>
              </Field>
              <div style={infoBox}>
                <AlertCircle size={13} />
                <span>When the conversation exceeds the context window, the oldest messages are automatically removed to keep the active context under the limit. The system prompt and the last 2 messages are always preserved.</span>
              </div>
            </div>
          )}

          {/* ── SEARCH ── */}
          {tab === 'search' && (
            <div style={fields}>
              <Field label='Search Provider'>
                <select style={inp} value={local.searchProvider || 'none'} onChange={e => set('searchProvider', e.target.value)}>
                  {SEARCH_PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}{p.free ? ` — ${p.free}` : ''}</option>
                  ))}
                </select>
              </Field>
              {local.searchProvider && local.searchProvider !== 'none' && local.searchProvider !== 'duckduckgo' && (
                <Field label='API Key'>
                  <input style={inp} type='password' value={local.searchApiKey || ''}
                    onChange={e => set('searchApiKey', e.target.value)}
                    placeholder='Paste your API key here' />
                </Field>
              )}
              {local.searchProvider && local.searchProvider !== 'none' && (
                <a href={SEARCH_PROVIDERS.find(p => p.value === local.searchProvider)?.url}
                  target='_blank' rel='noreferrer'
                  style={{ fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={10} /> Get API key →
                </a>
              )}
            </div>
          )}

          {/* ── TOOLS ── */}
          {tab === 'tools' && (
            <div style={fields}>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                Custom tools extend the agent. Each tool name will be callable by the model.
              </div>
              {(local.customTools || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>
                  No custom tools yet.
                </div>
              )}
              {(local.customTools || []).map((t, i) => (
                <div key={i} style={toolRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{t.description}</div>
                  </div>
                  <button onClick={() => set('customTools', local.customTools.filter((_, j) => j !== i))} style={iconBtn}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        <div style={footer}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={handleSave} style={saveBtn}>Save changes</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: 10 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const overlay   = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, backdropFilter:'blur(4px)' }
const modal     = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:16, width:500, maxWidth:'95vw', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', overflow:'hidden' }
const modalHeader = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', borderBottom:'1px solid var(--border)' }
const tabBar    = { display:'flex', gap:2, padding:'8px 10px', borderBottom:'1px solid var(--border)', background:'var(--bg-2)', flexWrap:'wrap' }
const tabBtn    = { padding:'5px 10px', borderRadius:7, fontSize:12, fontWeight:500, color:'var(--text-2)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit' }
const tabActive = { background:'var(--bg)', color:'var(--text)', boxShadow:'var(--shadow)', border:'1px solid var(--border)' }
const body      = { padding:16, overflowY:'auto', flex:1 }
const fields    = { display:'flex', flexDirection:'column', gap:14 }
const inp       = { background:'var(--bg-2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:13, color:'var(--text)', outline:'none', width:'100%', fontFamily:'inherit', boxSizing:'border-box' }
const textarea  = { ...inp, resize:'vertical', minHeight:80 }
const footer    = { display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 16px', borderTop:'1px solid var(--border)' }
const cancelBtn = { padding:'7px 14px', borderRadius:8, fontSize:13, color:'var(--text-2)', border:'1px solid var(--border)', background:'none', cursor:'pointer' }
const saveBtn   = { padding:'7px 16px', borderRadius:8, fontSize:13, background:'var(--accent)', color:'#fff', border:'none', cursor:'pointer', fontWeight:600 }
const iconBtn   = { display:'flex', alignItems:'center', padding:6, borderRadius:6, background:'none', border:'none', color:'var(--text-2)', cursor:'pointer' }
const refreshBtn = { display:'flex', alignItems:'center', padding:'8px 10px', borderRadius:8, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)', cursor:'pointer', flexShrink:0 }
const sliderGrid = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }
const slider    = { width:'100%', accentColor:'var(--accent)', cursor:'pointer' }
const toolRow   = { display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg-2)', borderRadius:8, border:'1px solid var(--border)' }
const warnBox   = { display:'flex', gap:10, padding:12, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, color:'#ef4444', fontSize:11, lineHeight:1.5 }
const infoBox   = { display:'flex', gap:10, padding:12, background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:8, color:'var(--text-2)', fontSize:11, lineHeight:1.5 }
