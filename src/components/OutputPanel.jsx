import { useRef, useEffect } from 'react'
import { Wrench, Inbox } from 'lucide-react'
import ToolCallCard from './ToolCallCard.jsx'

export default function OutputPanel({ toolCalls }) {
  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [toolCalls])

  return (
    <div style={panel}>
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Wrench size={13} color='var(--text-3)' />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Tool Activity</span>
        </div>
        {toolCalls.length > 0 && <span style={badge}>{toolCalls.length}</span>}
      </div>
      <div style={body}>
        {toolCalls.length === 0
          ? <div style={empty}><Inbox size={26} color='var(--text-3)' strokeWidth={1.5} /><span style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 8, textAlign: 'center', lineHeight: 1.6 }}>Tool calls will appear<br />here when used</span></div>
          : <div style={list}>{toolCalls.map((call, i) => <ToolCallCard key={i} call={call} />)}</div>
        }
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

const panel = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }
const badge = { fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 6px' }
const body = { flex: 1, overflowY: 'auto', padding: 10 }
const empty = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, padding: 24 }
const list = { display: 'flex', flexDirection: 'column', gap: 8 }