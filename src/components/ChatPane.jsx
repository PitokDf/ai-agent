import { useRef, useEffect, useState } from 'react'
import { Send, Square, Trash2 } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import FileAttachment from './FileAttachment.jsx'

const EXAMPLES = [
  'Calculate compound interest on $10,000 at 5% for 10 years',
  'Search for the latest AI model releases',
  'Run: [1,2,3,4,5].reduce((a,b)=>a+b,0)',
]

export default function ChatPane({ messages, isLoading, streamingText, streamingThinking, onSend, onStop, onClear, uploadedFiles, onAddFile, onRemoveFile, model }) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamingText])

  function submit() {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    onSend(text)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const chatMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant')
  const hasMessages = chatMessages.length > 0

  return (
    <div style={pane}>
      <div style={header}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            Chat
            {isLoading && streamingThinking && (
              <span style={thinkingBadge}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--thinking-accent)', display: 'inline-block', animation: 'thinkingPulse 1.2s ease-in-out infinite' }} />
                Thinking…
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{model}</div>
        </div>
        {hasMessages && (
          <button style={iconBtn} onClick={onClear} title='Clear chat'><Trash2 size={14} /></button>
        )}
      </div>

      <div style={messagesArea}>
        {!hasMessages ? (
          <div style={emptyState}>
            <div style={emptyIcon}>
              <svg width='28' height='28' viewBox='0 0 28 28' fill='none'>
                <circle cx='14' cy='14' r='12' stroke='var(--accent)' strokeWidth='1.5' opacity='0.3' />
                <circle cx='14' cy='14' r='7' stroke='var(--accent)' strokeWidth='1.5' opacity='0.6' />
                <circle cx='14' cy='14' r='3' fill='var(--accent)' />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Agent ready</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.6, maxWidth: 260 }}>
              Ask anything. Uses tools automatically when needed.
            </div>
            <div style={examples}>
              {EXAMPLES.map((ex, i) => (
                <button key={i} style={exBtn} onClick={() => { setInput(ex); textareaRef.current?.focus() }}>{ex}</button>
              ))}
            </div>
          </div>
        ) : (
          <div style={msgList}>
            {chatMessages.map((m, i) => <MessageBubble key={i} message={m} />)}
            {isLoading && (streamingText || streamingThinking) && (
              <MessageBubble message={{ role: 'assistant', content: streamingText || '' }} isStreaming streamingThinking={streamingThinking} />
            )}
            {isLoading && !streamingText && !streamingThinking && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingLeft: 34 }}>
                <div className='thinking-dots' style={{ display: 'flex', gap: 5, padding: '10px 14px', background: 'var(--assistant-bg)', border: '1px solid var(--border)', borderRadius: 14, borderBottomLeftRadius: 4 }}>
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={inputArea}>
        {Object.keys(uploadedFiles).length > 0 && (
          <div style={{ padding: '6px 12px 0', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <FileAttachment files={uploadedFiles} onAdd={onAddFile} onRemove={onRemoveFile} showChips />
          </div>
        )}
        <div style={inputRow}>
          <FileAttachment files={{}} onAdd={onAddFile} onRemove={onRemoveFile} showChips={false} />
          <textarea
            ref={textareaRef}
            style={textarea}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Message... (Shift+Enter for newline)'
            rows={1}
            disabled={isLoading}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px' }}
          />
          {isLoading
            ? <button style={{ ...sendBtn, background: 'var(--bg-3)' }} onClick={onStop}><Square size={13} color='var(--text-2)' /></button>
            : <button style={{ ...sendBtn, opacity: input.trim() ? 1 : 0.35 }} onClick={submit} disabled={!input.trim()}><Send size={13} color='#fff' /></button>
          }
        </div>
      </div>
    </div>
  )
}

const pane = { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
const header = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }
const messagesArea = { flex: 1, overflowY: 'auto', padding: '12px 14px' }
const msgList = { display: 'flex', flexDirection: 'column', gap: 8 }
const emptyState = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 4, padding: 24 }
const emptyIcon = { marginBottom: 10 }
const examples = { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14, width: '100%', maxWidth: 320 }
const exBtn = { padding: '8px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }
const inputArea = { borderTop: '1px solid var(--border)', flexShrink: 0 }
const inputRow = { display: 'flex', alignItems: 'flex-end', gap: 8, padding: '10px 12px' }
const textarea = { flex: 1, resize: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', background: 'var(--bg-2)', color: 'var(--text)', outline: 'none', lineHeight: 1.55, minHeight: 38, maxHeight: 140 }
const sendBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', border: 'none', cursor: 'pointer', flexShrink: 0 }
const iconBtn = { display: 'flex', alignItems: 'center', padding: 7, borderRadius: 7, background: 'none', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer' }
const thinkingBadge = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, color: 'var(--thinking-accent)', background: 'var(--thinking-bg)', border: '1px solid var(--thinking-border)', padding: '2px 7px', borderRadius: 99, letterSpacing: '-0.01em' }