import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { Zap, Plus, Trash2, ChevronDown, ChevronUp, Check, X } from 'lucide-react'
import { BUILTIN_SKILLS } from '../settings.js'

export function SkillIcon({ name, size = 14, color = 'currentColor' }) {
  const Icon = LucideIcons[name] || LucideIcons.Zap
  return <Icon size={size} color={color} />
}

export default function SkillsPanel({ skills, activeSkills, onToggle, onAddSkill, onDeleteSkill, collapsed, onToggleCollapse }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newSkill, setNewSkill] = useState({ name: '', icon: 'Zap', description: '', instructions: '' })

  const allSkills = [...BUILTIN_SKILLS, ...skills]

  function handleAdd() {
    if (!newSkill.name || !newSkill.instructions) return
    onAddSkill({ ...newSkill, id: `custom-${Date.now()}`, builtin: false })
    setNewSkill({ name: '', icon: 'Zap', description: '', instructions: '' })
    setShowAdd(false)
  }

  return (
    <div style={panel}>
      <div style={headerRow}>
        <button style={headerBtn} onClick={onToggleCollapse}>
          <Zap size={12} color='var(--accent)' />
          <span style={headerLabel}>Skills</span>
          {activeSkills.length > 0 && (
            <span style={activeBadge}>{activeSkills.length} on</span>
          )}
          {collapsed ? <ChevronDown size={11} color='var(--text-3)' /> : <ChevronUp size={11} color='var(--text-3)' />}
        </button>
        {!collapsed && (
          <button
            style={addIconBtn}
            onClick={() => setShowAdd(p => !p)}
            title='Register new specialist'
          >
            {showAdd ? <X size={13} /> : <Plus size={13} />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div style={body}>
          {showAdd ? (
            <div style={addForm}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  style={{ ...inp, width: 64, textAlign: 'center', flexShrink: 0 }}
                  value={newSkill.icon}
                  onChange={e => setNewSkill(p => ({ ...p, icon: e.target.value }))}
                  placeholder='Icon'
                />
                <input
                  style={{ ...inp, flex: 1 }}
                  value={newSkill.name}
                  onChange={e => setNewSkill(p => ({ ...p, name: e.target.value }))}
                  placeholder='Specialist name'
                />
              </div>
              <input
                style={inp}
                value={newSkill.description}
                onChange={e => setNewSkill(p => ({ ...p, description: e.target.value }))}
                placeholder='Brief description'
              />
              <textarea
                style={{ ...inp, height: 68, resize: 'none', lineHeight: 1.5 }}
                value={newSkill.instructions}
                onChange={e => setNewSkill(p => ({ ...p, instructions: e.target.value }))}
                placeholder='System instructions for this specialist...'
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowAdd(false)} style={cancelBtn}>Cancel</button>
                <button onClick={handleAdd} style={saveBtn}>Add</button>
              </div>
            </div>
          ) : (
            <div style={grid}>
              {allSkills.map(skill => {
                const active = activeSkills.includes(skill.id)
                return (
                  <div
                    key={skill.id}
                    style={{ ...chip, ...(active ? chipActive : {}) }}
                    onClick={() => onToggle(skill.id)}
                    title={skill.description || skill.instructions?.slice(0, 120)}
                  >
                    <div style={{ ...chipIconWrap, ...(active ? chipIconWrapActive : {}) }}>
                      <SkillIcon name={skill.icon} size={13} color={active ? 'var(--accent)' : 'var(--text-3)'} />
                    </div>
                    <span style={{ ...chipName, ...(active ? { color: 'var(--accent)', fontWeight: 700 } : {}) }}>
                      {skill.name}
                    </span>
                    <div style={chipFooter}>
                      {active && <Check size={9} color='var(--accent)' />}
                      {!skill.builtin && (
                        <button
                          style={delChipBtn}
                          onClick={e => { e.stopPropagation(); onDeleteSkill(skill.id) }}
                          title='Remove'
                        >
                          <Trash2 size={9} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const panel = {
  borderBottom: '1px solid var(--border)',
}

const headerRow = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '2px 6px 2px 2px',
}

const headerBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1,
  padding: '9px 10px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
}

const headerLabel = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text)',
  letterSpacing: '0.01em',
  flex: 1,
}

const activeBadge = {
  fontSize: 9,
  fontWeight: 700,
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 99,
  padding: '1px 5px',
  letterSpacing: '0.02em',
}

const addIconBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 7,
  background: 'none',
  border: '1px solid var(--border)',
  color: 'var(--text-3)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'all 0.15s',
}

const body = {
  padding: '0 10px 12px',
}

const grid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 5,
}

const chip = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '10px 6px 7px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-2)',
  cursor: 'pointer',
  transition: 'all 0.15s',
  userSelect: 'none',
  minWidth: 0,
  position: 'relative',
}

const chipActive = {
  border: '1px solid var(--accent)',
  background: 'var(--accent-bg)',
  boxShadow: '0 0 0 1px var(--accent) inset',
}

const chipIconWrap = {
  width: 28,
  height: 28,
  borderRadius: 8,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  transition: 'all 0.15s',
}

const chipIconWrapActive = {
  background: 'var(--accent-bg)',
  borderColor: 'var(--accent)',
}

const chipName = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-2)',
  textAlign: 'center',
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
  letterSpacing: '-0.01em',
}

const chipFooter = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  height: 12,
}

const delChipBtn = {
  display: 'flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-3)',
  padding: 1,
  borderRadius: 3,
  transition: 'color 0.15s',
}

const addForm = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const inp = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  padding: '6px 9px',
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
}

const cancelBtn = {
  flex: 1,
  padding: '6px',
  borderRadius: 7,
  fontSize: 12,
  border: '1px solid var(--border)',
  background: 'none',
  color: 'var(--text-2)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const saveBtn = {
  flex: 1,
  padding: '6px',
  borderRadius: 7,
  fontSize: 12,
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 600,
  fontFamily: 'inherit',
}