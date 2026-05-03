import { useRef, useState, useEffect } from 'react'
import { 
  FileText, ChevronRight, Terminal, Globe, Calculator, Cpu, 
  Sun, Droplets, Wind, TrendingDown, ArrowUpRight, Clock 
} from 'lucide-react'
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.setOptions({ breaks: true, gfm: true })
marked.use(markedKatex({ throwOnError: false }))

const renderer = new marked.Renderer()
renderer.code = ({ text, lang }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value
  const encoded = encodeURIComponent(text)
  return `<div class="code-block">
  <div class="code-header">
    <span class="code-lang">${language}</span>
    <button class="copy-btn" data-code="${encoded}">Copy</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`
}
marked.use({ renderer })

// --- STYLES ---
const toolResultPre = { margin: 0, padding: 12, fontSize: 11, background: 'var(--bg-3)', color: 'var(--text-2)', overflowX: 'auto', borderTop: '1px solid var(--border)' }
const weatherCard = { background: 'linear-gradient(135deg, var(--accent), #7c3aed)', color: '#fff', borderRadius: 12, padding: 16, marginTop: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
const tempBox = { fontSize: 32, fontWeight: 800 }
const weatherMeta = { display: 'flex', gap: 15, marginTop: 15, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 12 }
const metaItem = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }
const stockCard = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 8, boxShadow: 'var(--shadow)' }
const toolCallBox = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const toolCallHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }
const toolStatusPill = (status) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: status === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', color: status === 'done' ? '#22c55e' : '#eab308' })

const wrapper = { display: 'flex', alignItems: 'flex-end', gap: 8, padding: '2px 0' }
const avatar = { width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: 2 }
const bubble = { padding: '10px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.65, wordBreak: 'break-word' }
const userBubble = { background: 'var(--user-bg)', color: 'var(--user-text)', borderBottomRightRadius: 4 }
const assistantBubble = { background: 'var(--assistant-bg)', color: 'var(--text)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }
const cursor = { display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite', borderRadius: 1 }
const thinkingToggleBtn = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }
const thinkingIconWrap = { width: 22, height: 22, borderRadius: 6, background: 'rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const thinkingLabel = { fontSize: 12, fontWeight: 600, color: 'var(--thinking-accent)', letterSpacing: '-0.01em' }
const wordBadge = { fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--thinking-accent)', opacity: 0.7, background: 'rgba(168,85,247,0.12)', padding: '1px 6px', borderRadius: 99 }
const thinkingStreamBody = { padding: '0 12px 10px', borderTop: '1px solid rgba(168,85,247,0.2)', marginTop: 0, maxHeight: 200, overflowY: 'auto' }
const reasoningOpenBody = { padding: '10px 12px 12px', borderTop: '1px solid rgba(168,85,247,0.2)' }
const waveDotWrap = { display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }
const fileChip = { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(255,255,255,0.15)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }

function BrainIcon({ size = 14, color = 'currentColor', spinning = false }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={spinning ? { animation: 'spin 2s linear infinite' } : undefined}
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  )
}

function ToolResultRenderer({ result }) {
  if (!result || typeof result !== 'object') return null;
  if (result.type === 'weather') {
    return (
      <div style={weatherCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{result.city}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{result.area !== result.city ? `${result.area}, ` : ''}{result.country}</div>
          </div>
          <div style={tempBox}>{result.temp}{result.tempUnit || '°C'}</div>
        </div>
        <div style={weatherMeta}>
          <div style={metaItem}><Sun size={14} /> <span>{result.condition}</span></div>
          <div style={metaItem}><Droplets size={14} /> <span>{result.humidity}%</span></div>
          <div style={metaItem}><Wind size={14} /> <span>{result.wind} {result.windUnit || 'km/h'}</span></div>
        </div>
      </div>
    )
  }
  if (result.type === 'stock') {
    const isUp = parseFloat(result.change) >= 0;
    return (
      <div style={stockCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div><div style={{ fontWeight: 700, fontSize: 15 }}>{result.symbol}</div><div style={{ fontSize: 11, opacity: 0.6 }}>{result.name}</div></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{result.price} <span style={{ fontSize: 11 }}>{result.currency}</span></div>
            <div style={{ fontSize: 12, color: isUp ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              {isUp ? <ArrowUpRight size={14} /> : <TrendingDown size={14} />} {result.change} ({result.percent}%)
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Market Data</div><div>{new Date(result.timestamp).toLocaleTimeString()}</div>
        </div>
      </div>
    )
  }
  return null; // Don't show JSON pre in chat
}

function ThinkingWaveDots() {
  return <div style={waveDotWrap}>{[0, 1, 2].map(i => <div key={i} className="thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
}

function StreamingThinkingBlock({ text }) {
  return (
    <div style={{ background: 'rgba(168,85,247,0.05)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.15)', overflow: 'hidden', marginBottom: 8 }}>
      <div style={thinkingHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={thinkingIconWrap}><BrainIcon size={12} color="var(--thinking-accent)" spinning /></div><span style={thinkingLabel}>Thinking...</span><ThinkingWaveDots /></div></div>
      <div style={thinkingStreamBody}><div style={{ fontSize: 13, color: 'var(--thinking-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', opacity: 0.8 }}>{text}</div></div>
    </div>
  )
}

function ReasoningBlock({ content, processedContent }) {
  const [isOpen, setIsOpen] = useState(false)
  const wordCount = content.trim().split(/\s+/).length
  return (
    <div style={{ background: 'rgba(168,85,247,0.03)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.1)', overflow: 'hidden', marginBottom: 8 }}>
      <button onClick={() => setIsOpen(!isOpen)} style={thinkingToggleBtn}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={thinkingIconWrap}><BrainIcon size={12} color="var(--thinking-accent)" /></div><span style={thinkingLabel}>Thought Process</span><div style={wordBadge}>{wordCount} words</div></div>
        {isOpen ? <ChevronRight size={14} style={{ transform: 'rotate(90deg)', color: 'var(--thinking-accent)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
      </button>
      {isOpen && <div style={reasoningOpenBody}><div className="md-body reasoning" dangerouslySetInnerHTML={{ __html: marked.parse(processedContent || content) }} /></div>}
    </div>
  )
}

function FileChip({ name }) {
  return <div style={fileChip}><FileText size={12} /><span style={{ fontSize: 11, fontWeight: 500 }}>{name}</span></div>
}

export default function MessageBubble({ message, isStreaming, streamingThinking }) {
  const ref = useRef(null)
  const isUser = message.role === 'user'
  const { cleanedContent, reasoningContent, files } = extractContentData(message.content || '', message)
  const processedContent = !isUser ? cleanedContent.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$') : cleanedContent
  const processedReasoning = reasoningContent ? reasoningContent.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$').replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$') : ''

  const handleBodyClick = (e) => {
    if (e.target.classList.contains('copy-btn')) {
      const code = decodeURIComponent(e.target.dataset.code || '')
      navigator.clipboard.writeText(code)
      const btn = e.target; btn.innerText = 'Copied!'; setTimeout(() => { btn.innerText = 'Copy' }, 2000)
    }
  }

  return (
    <div style={{ ...wrapper, justifyContent: isUser ? 'flex-end' : 'flex-start' }} className='fade-in'>
      {!isUser && <div style={avatar}><svg width='14' height='14' viewBox='0 0 16 16' fill='none'><circle cx='8' cy='8' r='7' stroke='var(--accent)' strokeWidth='1.5' /><circle cx='8' cy='8' r='3' fill='var(--accent)' /></svg></div>}
      <div style={{ ...bubble, ...(isUser ? userBubble : assistantBubble), maxWidth: isUser ? '72%' : '86%' }}>
        {isUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{cleanedContent}</span>{files.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>{files.map((f, i) => <FileChip key={i} name={f} />)}</div>}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {isStreaming && !!streamingThinking && <StreamingThinkingBlock text={streamingThinking} />}
            {!isStreaming && reasoningContent && <ReasoningBlock content={reasoningContent} processedContent={processedReasoning} />}
            <div ref={ref} className='md-body' onClick={handleBodyClick} dangerouslySetInnerHTML={{ __html: marked.parse(processedContent) }} />
            {message.tool_calls && message.tool_calls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {message.tool_calls.map((call, idx) => (
                  <div key={idx} style={toolCallBox}>
                    <div style={toolCallHeader}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Terminal size={13} /><span style={{ fontSize: 12, fontWeight: 600 }}>{call.function?.name || call.name}</span></div><div style={toolStatusPill(call.status || 'done')}>{call.status === 'running' ? 'Running...' : 'Completed'}</div></div>
                    {call.result && <ToolResultRenderer result={call.result} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {isStreaming && !isUser && !streamingThinking && <span style={cursor} />}
      </div>
    </div>
  )
}

function extractContentData(content, message) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
  const fileRegex = /\[Uploaded Files: (.*?)\]/g
  let cleaned = content.replace(fileRegex, '').replace(thinkRegex, '').trim()
  let files = []
  const fileMatch = fileRegex.exec(content)
  if (fileMatch) files = fileMatch[1].split(',').map(f => f.trim())
  let reasoningContent = message.thinking || message.reasoning || ''
  if (!reasoningContent) {
    let match; while ((match = thinkRegex.exec(content)) !== null) { reasoningContent += (reasoningContent ? '\n\n' : '') + match[1].trim() }
  }
  return { cleanedContent: cleaned || content.replace(fileRegex, '').trim(), reasoningContent, files }
}
