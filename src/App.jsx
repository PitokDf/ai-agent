import { useState, useRef, useCallback, useEffect } from 'react'
import { Settings, Wifi, WifiOff, GripVertical, PanelLeft, Plus, MessageSquare, X } from 'lucide-react'
import ChatPane from './components/ChatPane.jsx'
import OutputPanel from './components/OutputPanel.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import SkillsPanel, { SkillIcon } from './components/SkillsPanel.jsx'
import { loadSettings, saveSettings, BUILTIN_SKILLS } from './settings.js'
import { runAgentLoop } from './agent.js'
import * as db from './db.js'
import './index.css'
import './markdown.css'
import "katex/dist/katex.min.css";

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [currentConvId, setCurrentConvId] = useState(null)
  const [toolCalls, setToolCalls] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState({})
  const [stagedFileNames, setStagedFileNames] = useState([])
  const [connected, setConnected] = useState(null)
  const [splitPct, setSplitPct] = useState(62)
  const [skillsPanelCollapsed, setSkillsPanelCollapsed] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const abortRef = useRef(null)
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const activeSkills = settings.activeSkills || []

  useEffect(() => {
    testConnection()
    loadHistory()
  }, [])

  async function loadHistory() {
    const list = await db.getAllConversations()
    setConversations(list.reverse())
  }

  async function handleNewChat() {
    setMessages([])
    setCurrentConvId(null)
    setStreamingText('')
    setStreamingThinking('')
    setToolCalls([])
  }

  async function selectConversation(id) {
    const conv = await db.getConversation(id)
    if (conv) {
      setMessages(conv.messages)
      setCurrentConvId(id)
    }
  }

  async function handleDeleteConv(e, id) {
    e.stopPropagation()
    await db.deleteConversation(id)
    if (currentConvId === id) handleNewChat()
    loadHistory()
  }

  function buildSystemPrompt() {
    let base = settings.systemPrompt
    const allSkills = [...BUILTIN_SKILLS, ...(settings.skills || [])]
    const active = allSkills.filter(s => activeSkills.includes(s.id))

    if (active.length > 0) {
      base += '\n\n' + '='.repeat(40) + '\n'
      base += '🚀 SPECIALIST MISSIONS ACTIVATED:\n'
      base += active.map(s => `\n### SPECIALIST: ${s.name.toUpperCase()}\n${s.instructions}`).join('\n\n')
      base += '\n' + '='.repeat(40) + '\n'
      base += '\nInstructions: You are currently operating with the specialist modules listed above. Prioritize their specific workflows, scripts, and technical instructions over general knowledge.'
    }
    return base
  }

  async function testConnection(s = settings) {
    const provider = s.provider || 'ollama'
    const config = s.providerConfigs?.[provider] || { apiUrl: s.apiUrl, apiKey: s.apiKey }

    if (!config.apiUrl) return setConnected(null)

    try {
      let endpoint = ''
      let headers = {}

      if (provider === 'ollama') {
        endpoint = `${config.apiUrl.replace(/\/$/, "")}/api/tags`
      } else if (provider === 'google') {
        endpoint = `${config.apiUrl.replace(/\/$/, "")}/models?key=${config.apiKey}`
      } else if (provider === 'cloudflare') {
        endpoint = `${config.apiUrl.replace(/\/$/, "")}/accounts/${config.accountId}/ai/models/search?search=llama`
        headers['Authorization'] = `Bearer ${config.apiKey}`
      } else if (provider === 'anthropic') {
        endpoint = `${config.apiUrl.replace(/\/$/, "")}/models`
        headers['x-api-key'] = config.apiKey
        headers['anthropic-version'] = '2023-06-01'
      } else {
        endpoint = `${config.apiUrl.replace(/\/$/, "")}/models`
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(5000) })
      setConnected(res.ok)
    } catch (e) {
      console.error('Connection test failed:', e)
      setConnected(false)
    }
  }

  function onDividerMouseDown(e) {
    e.preventDefault()
    dragging.current = true
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setSplitPct(Math.min(80, Math.max(25, ((e.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleSend = useCallback(async (text) => {
    if (isLoading) return
    const systemPrompt = buildSystemPrompt()
    const systemMsg = { role: 'system', content: systemPrompt }
    const userMsg = { role: 'user', content: text }
    const newMessages = messages.length === 0 ? [systemMsg, userMsg] : [...messages, userMsg]

    setMessages(newMessages)
    setIsLoading(true)
    setStreamingText('')
    setStreamingThinking('')
    setToolCalls([])

    const controller = new AbortController()
    abortRef.current = controller
    let localToolCalls = []

    const filesSnapshot = { ...uploadedFiles }
    setUploadedFiles({})

    await runAgentLoop({
      messages: newMessages,
      settings,
      uploadedFiles: filesSnapshot,
      stagedFiles: stagedFileNames,
      signal: controller.signal,
      onStreamReset: () => {
        setStreamingText('')
        setStreamingThinking('')
      },
      onToken: (t) => setStreamingText(p => p + t),
      onThinkingToken: (t) => setStreamingThinking(p => p + t),
      onToolCall: ({ id, name, args }) => {
        localToolCalls = [...localToolCalls, { id, name, args, result: null, status: 'running' }]
        setToolCalls([...localToolCalls])
      },
      onToolResult: ({ id, result }) => {
        localToolCalls = localToolCalls.map(c => c.id === id ? { ...c, result, status: result?.error ? 'error' : 'done' } : c)
        setToolCalls([...localToolCalls])
      },
      onMessagesUpdate: (history) => {
        setMessages(history)
      },
      onDone: async (history) => {
        setMessages(history)
        setStreamingText('')
        setStreamingThinking('')
        setIsLoading(false)

        const id = currentConvId || Date.now().toString()
        if (!currentConvId) setCurrentConvId(id)

        const firstUserMsg = history.find(m => m.role === 'user')?.content || 'New Chat'
        const title = firstUserMsg.slice(0, 30) + (firstUserMsg.length > 30 ? '...' : '')
        await db.saveConversation(id, history, title)
        loadHistory()
      },
      onError: (msg) => {
        setMessages(p => [...p, { role: 'assistant', content: `⚠️ **Error:** ${msg}\n\nCheck Settings → Connection tab.` }])
        setStreamingText(''); setIsLoading(false)
      }
    })
    setStagedFileNames([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, settings, uploadedFiles, isLoading, activeSkills, stagedFileNames, currentConvId])

  function handleStop() {
    abortRef.current?.abort()
    setIsLoading(false)
    setStreamingThinking('')
    // Only save streaming text if it's non-empty and represents unsaved content.
    // onStreamReset clears streamingText at the start of each round, so whatever
    // remains is from the current (incomplete) round and hasn't been committed yet.
    setStreamingText(current => {
      if (current) {
        setMessages(p => {
          const last = p[p.length - 1]
          if (last?.role === 'assistant' && !last.tool_calls?.length && last.content === current) return p
          return [...p, { role: 'assistant', content: current }]
        })
      }
      return ''
    })
  }

  function handleToggleSkill(id) {
    const next = activeSkills.includes(id) ? activeSkills.filter(s => s !== id) : [...activeSkills, id]
    const updated = { ...settings, activeSkills: next }
    setSettings(updated)
    saveSettings(updated)
    if (messages.length > 0) setMessages([])
  }

  function handleAddSkill(skill) {
    const updated = { ...settings, skills: [...(settings.skills || []), skill] }
    setSettings(updated); saveSettings(updated)
  }

  async function handleAddFile(name, data) {
    setUploadedFiles(p => ({ ...p, [name]: data }))
    setStagedFileNames(p => [...p, name])

    if (name.toLowerCase() === 'skills.md' || name.toLowerCase() === 'skill.md') {
      try {
        const text = typeof data.text === 'function' ? await data.text() : data.content || ''
        const skills = parseSkillsMarkdown(text)
        const existingIds = (settings.skills || []).map(s => s.id)
        const newSkills = skills.filter(s => !existingIds.includes(s.id))
        if (newSkills.length > 0) {
          const updated = { ...settings, skills: [...(settings.skills || []), ...newSkills] }
          setSettings(updated); saveSettings(updated)
          alert(`Success! Imported ${newSkills.length} specialist skills from ${name}`)
        }
      } catch (err) {
        console.error('Failed to parse skills file:', err)
      }
    }
  }

  function parseSkillsMarkdown(text) {
    const skills = []
    const sections = text.split('\n## ').slice(1)

    for (const section of sections) {
      const lines = section.split('\n')
      const name = lines[0].trim()
      let icon = 'Zap', description = '', instructions = ''
      let instStarted = false

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith('Icon:')) icon = line.replace('Icon:', '').trim()
        else if (line.startsWith('Description:')) description = line.replace('Description:', '').trim()
        else if (line.startsWith('Instructions:')) {
          instStarted = true
          instructions = line.replace('Instructions:', '').trim()
        } else if (instStarted) {
          instructions += '\n' + line
        }
      }

      if (name) {
        skills.push({
          id: 'md-' + name.toLowerCase().replace(/\s+/g, '-'),
          name, icon, description, instructions: instructions.trim()
        })
      }
    }
    return skills
  }

  function handleRemoveFile(name) {
    setStagedFileNames(p => p.filter(n => n !== name))
  }

  function handleDeleteSkill(id) {
    const updated = {
      ...settings,
      skills: (settings.skills || []).filter(s => s.id !== id),
      activeSkills: activeSkills.filter(s => s !== id)
    }
    setSettings(updated); saveSettings(updated)
  }

  function handleSettingsUpdate(s) {
    setSettings(s); setConnected(null); testConnection(s)
  }

  return (
    <div style={appShell}>
      <header style={titlebar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={iconBtn} onClick={() => setSidebarVisible(p => !p)} title='Toggle sidebar'>
            <PanelLeft size={15} />
          </button>
          <div style={logoBox}>
            <svg width='15' height='15' viewBox='0 0 16 16' fill='none'>
              <circle cx='8' cy='8' r='7' stroke='var(--accent)' strokeWidth='1.5' />
              <circle cx='8' cy='8' r='3.5' stroke='var(--accent)' strokeWidth='1.2' opacity='0.5' />
              <circle cx='8' cy='8' r='1.5' fill='var(--accent)' />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>AI Agent</span>
          {activeSkills.length > 0 && (
            <div style={skillsBadge}>
              {(() => {
                const allS = [...BUILTIN_SKILLS, ...(settings.skills || [])]
                return (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {activeSkills.map(id => <SkillIcon key={id} name={allS.find(s => s.id === id)?.icon} />)}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={connPill} onClick={() => testConnection()}>
            {connected === true ? <Wifi size={12} color='#22c55e' /> : connected === false ? <WifiOff size={12} color='#ef4444' /> : <Wifi size={12} color='var(--text-3)' />}
            <span style={{ fontSize: 11, color: connected === true ? '#22c55e' : connected === false ? '#ef4444' : 'var(--text-3)' }}>
              {connected === true ? 'Connected' : connected === false ? 'Offline' : 'Test'}
            </span>
          </button>
          <button style={settingsPill} onClick={() => setShowSettings(true)}>
            <Settings size={13} /><span style={{ fontSize: 12 }}>Settings</span>
          </button>
        </div>
      </header>

      <div style={body}>
        {sidebarVisible && (
          <div style={sidebar}>
            <SkillsPanel
              skills={settings.skills || []}
              activeSkills={activeSkills}
              onToggle={handleToggleSkill}
              onAddSkill={handleAddSkill}
              onDeleteSkill={handleDeleteSkill}
              collapsed={skillsPanelCollapsed}
              onToggleCollapse={() => setSkillsPanelCollapsed(p => !p)}
            />

            <div style={historySection}>
              <div style={historyHeader}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>History</span>
                <button style={newChatBtn} onClick={handleNewChat} title="New Chat">
                  <Plus size={14} />
                </button>
              </div>
              <div style={historyList}>
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className='history-item'
                    style={{ ...historyItem, ...(currentConvId === conv.id ? historyActive : {}) }}
                    onClick={() => selectConversation(conv.id)}
                  >
                    <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.7 }} />
                    <span style={historyTitle}>{conv.title}</span>
                    <button className='del-btn' style={delHistoryBtn} onClick={(e) => handleDeleteConv(e, conv.id)}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={sidebarHint}>
              Active skills are injected into the system prompt each conversation.
            </div>
          </div>
        )}

        <div ref={containerRef} style={splitLayout}>
          <div style={{ width: `${splitPct}%`, minWidth: 260, height: '100%', overflow: 'hidden' }}>
            <ChatPane
              messages={messages}
              isLoading={isLoading}
              streamingText={streamingText}
              streamingThinking={streamingThinking}
              onSend={handleSend}
              onStop={handleStop}
              onClear={() => { setMessages([]); setToolCalls([]); setStreamingThinking(''); setUploadedFiles({}); setStagedFileNames([]); setCurrentConvId(null) }}
              uploadedFiles={Object.fromEntries(stagedFileNames.map(n => [n, uploadedFiles[n]]))}
              onAddFile={handleAddFile}
              onRemoveFile={handleRemoveFile}
              model={settings.model}
            />
          </div>

          <div style={dividerBar} onMouseDown={onDividerMouseDown}>
            <GripVertical size={13} color='var(--text-3)' />
          </div>

          <div style={{ flex: 1, minWidth: 200, height: '100%', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
            <OutputPanel toolCalls={toolCalls} />
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onUpdate={handleSettingsUpdate} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

const appShell = { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }
const titlebar = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 44, borderBottom: '1px solid var(--border)', flexShrink: 0, userSelect: 'none' }
const logoBox = { width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-bg)', border: '1px solid var(--border)' }
const body = { display: 'flex', flex: 1, overflow: 'hidden' }
const sidebar = { width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }
const splitLayout = { display: 'flex', flex: 1, overflow: 'hidden' }
const dividerBar = { width: 14, flexShrink: 0, cursor: 'col-resize', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }
const connPill = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 8, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const settingsPill = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }
const iconBtn = { display: 'flex', alignItems: 'center', padding: 6, borderRadius: 7, background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer' }
const skillsBadge = { fontSize: 13, padding: '2px 7px', background: 'var(--accent-bg)', border: '1px solid var(--border)', borderRadius: 99 }
const sidebarHint = { padding: '10px 14px', fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5, marginTop: 'auto' }

const historySection = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, borderTop: '1px solid var(--border)', marginTop: 10 }
const historyHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px' }
const historyList = { flex: 1, overflowY: 'auto', padding: '0 8px' }
const historyItem = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-2)', transition: 'all 0.15s', position: 'relative', marginBottom: 2 }
const historyActive = { background: 'var(--bg-3)', color: 'var(--text)', fontWeight: 500 }
const historyTitle = { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const newChatBtn = { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }
const delHistoryBtn = { background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 3, opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', flexShrink: 0 }