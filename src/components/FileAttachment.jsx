import { useRef } from 'react'
import { Paperclip, X, FileText, Image } from 'lucide-react'

export default function FileAttachment({ files, onAdd, onRemove, showChips = true }) {
  const inputRef = useRef(null)

  function handleFiles(e) {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader()
      reader.onload = evt => {
        onAdd(file.name, { content: evt.target.result, type: file.type, size: file.size })
      }
      const isText = file.type.startsWith('text') || /\.(js|ts|jsx|tsx|json|md|py|css|html|xml|csv|txt|yaml|yml|sh)$/i.test(file.name)
      if (isText) reader.readAsText(file)
      else reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
      <button style={attachBtn} onClick={() => inputRef.current?.click()} title='Attach file'>
        <Paperclip size={14} />
      </button>
      <input ref={inputRef} type='file' multiple style={{ display: 'none' }} onChange={handleFiles} />

      {showChips && Object.keys(files).map(name => {
        const isImg = files[name]?.type?.startsWith('image')
        const Icon = isImg ? Image : FileText
        return (
          <div key={name} style={chip}>
            <Icon size={10} color='var(--accent)' />
            <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{name}</span>
            <button onClick={() => onRemove(name)} style={removeBtn}><X size={9} /></button>
          </div>
        )
      })}
    </div>
  )
}

const attachBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0 }
const chip = { display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--accent-bg)', border: '1px solid var(--border)', color: 'var(--text)' }
const removeBtn = { display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 1 }