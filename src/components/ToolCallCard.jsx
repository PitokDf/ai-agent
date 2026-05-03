import { useState } from 'react'
import { ChevronDown, ChevronRight, Calculator, Globe, Terminal, FileText, Zap, CheckCircle2, Loader2, AlertCircle, Sun, TrendingUp } from 'lucide-react'

const ICONS = { calculator: Calculator, web_search: Globe, code_executor: Terminal, read_file: FileText, get_weather: Sun, get_stock_price: TrendingUp }
const COLORS = { calculator: '#f59e0b', web_search: '#10b981', code_executor: '#8b5cf6', read_file: '#3b82f6', get_weather: '#7c3aed', get_stock_price: '#10b981' }

export default function ToolCallCard({ call }) {
  const [expanded, setExpanded] = useState(true)
  const { name, args, result, status } = call
  const Icon = ICONS[name] || Zap
  const color = COLORS[name] || '#6b7280'

  return (
    <div style={card} className='slide-in'>
      <button style={header} onClick={() => setExpanded(p => !p)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...iconWrap, background: color + '18', border: `1px solid ${color}28` }}>
            <Icon size={12} color={color} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
            {(name || 'Tool Call').replace(/_/g, ' ')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {status === 'running' && <Loader2 size={12} color='var(--text-3)' style={{ animation: 'spin 1s linear infinite' }} />}
          {status === 'done' && <CheckCircle2 size={12} color='#22c55e' />}
          {status === 'error' && <AlertCircle size={12} color='#ef4444' />}
          {expanded ? <ChevronDown size={12} color='var(--text-3)' /> : <ChevronRight size={12} color='var(--text-3)' />}
        </div>
      </button>

      {expanded && (
        <div style={body}>
          <Section label='Input'><pre style={pre}>{JSON.stringify(args, null, 2)}</pre></Section>
          {result && <Section label='Output'>{renderResult(name, result)}</Section>}
        </div>
      )}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {children}
    </div>
  )
}

function renderResult(name, result) {
  if (result.error) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <pre style={{ ...pre, color: '#ef4444', background: '#fee2e210' }}>{result.error}</pre>
      {result.hint && <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, padding: '6px 8px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>{result.hint}</div>}
    </div>
  )

  if (name === 'calculator') return (
    <pre style={pre}>{result.expression} = <strong style={{ color: '#f59e0b', fontSize: 14 }}>{result.result}</strong></pre>
  )

  if (name === 'web_search') {
    if (!result.results?.length) return <pre style={pre}>{result.note || 'No results'}</pre>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {result.provider && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>via {result.provider}</div>}
        {result.results.map((r, i) => (
          <div key={i} style={searchItem}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 2 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{r.snippet}</div>
            {r.url && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, wordBreak: 'break-all' }}>{r.url}</div>}
          </div>
        ))}
      </div>
    )
  }

  if (name === 'code_executor') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {result.output && <pre style={pre}>{result.output}</pre>}
      {result.returnValue && <pre style={{ ...pre, color: '#22c55e' }}>→ {result.returnValue}</pre>}
    </div>
  )

  if (name === 'read_file') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{result.filename} · {result.size} bytes</div>
      <pre style={{ ...pre, maxHeight: 160, overflow: 'auto' }}>{result.content}</pre>
    </div>
  )

  if (result.type === 'weather') return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      <strong>{result.city}, {result.country}</strong>: {result.temp}{result.tempUnit} ({result.condition})
      <div style={{ color: 'var(--text-3)' }}>Humidity: {result.humidity}% · Wind: {result.wind}{result.windUnit}</div>
    </div>
  )

  if (result.type === 'stock') return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      <strong>{result.name} ({result.symbol})</strong>: {result.price} {result.currency}
      <div style={{ color: parseFloat(result.change) >= 0 ? '#22c55e' : '#ef4444' }}>{result.change} ({result.percent}%)</div>
    </div>
  )

  return <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>
}

const card = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', fontSize: 12 }
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', width: '100%', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', fontFamily: 'inherit' }
const iconWrap = { width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const body = { padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }
const pre = { fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 9px', color: 'var(--text-2)', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, margin: 0 }
const searchItem = { padding: '7px 9px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }