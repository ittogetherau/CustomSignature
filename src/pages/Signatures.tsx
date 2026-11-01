import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, CopyPlus, Download, MoreHorizontal, PenLine, Plus, Trash2, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { exportDocument, renderSignature } from '../lib/render'
import { templateById } from '../lib/templates'
import { copyRich, download, slug, timeAgo } from '../lib/io'
import { Empty, Modal, PageHeader, SigThumb, useToast } from '../components/ui'

export default function Signatures() {
  const { signatures, campaigns, deleteSignature, duplicateSignature } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="My signatures"
        subtitle="Keep a few for different moments — a full one for new threads, a short one for replies, a formal one for clients."
        actions={<Link to="/templates" className="btn btn-ink"><Plus size={16} /> New signature</Link>}
      />

      {signatures.length === 0 ? (
        <Empty icon={<PenLine />} title="No signatures yet" body="Choose a template to create your first one. It takes about two minutes." action={<Link to="/templates" className="btn btn-ink">Browse templates</Link>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {signatures.map((s, i) => {
            const t = templateById(s.templateId)
            return (
              <article key={s.id} className="card group animate-rise overflow-hidden" style={{ animationDelay: `${i * 50}ms` }}>
                <button onClick={() => navigate(`/editor/${s.id}`)} className="relative block h-[220px] w-full overflow-hidden border-b border-line bg-white px-6 text-left">
                  <div className="flex h-full items-center"><SigThumb html={renderSignature(s, { campaigns })} max={0.9} maxH={190} /></div>
                  <span className="absolute right-3 top-3 flex translate-y-1 items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-paper opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"><PenLine size={12} /> Edit</span>
                </button>
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="h-display truncate text-lg">{s.label}</h3>
                      {i === 0 && <span className="tag bg-pine-soft text-pine">Default</span>}
                      {s.extras.animations && <Sparkles size={13} className="text-clay" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{t.name} · edited {timeAgo(s.updatedAt)}</div>
                  </div>
                  <button className="btn btn-line btn-sm" onClick={async () => { await copyRich(renderSignature(s, { campaigns })); toast('Signature copied') }}><Copy size={14} /> Copy</button>
                  <div className="relative">
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setMenu(menu === s.id ? null : s.id)} aria-label="More"><MoreHorizontal size={16} /></button>
                    {menu === s.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenu(null)} />
                        <div className="card absolute bottom-full right-0 z-20 mb-1 w-44 animate-rise p-1 shadow-lift">
                          <MenuItem icon={<CopyPlus size={14} />} onClick={() => { const c = duplicateSignature(s.id); setMenu(null); if (c) toast('Duplicated') }}>Duplicate</MenuItem>
                          <MenuItem icon={<Download size={14} />} onClick={() => { download(`${slug(s.label)}.html`, exportDocument(s, { campaigns })); setMenu(null) }}>Download HTML</MenuItem>
                          <MenuItem icon={<Trash2 size={14} />} danger onClick={() => { setConfirm(s.id); setMenu(null) }}>Delete</MenuItem>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Delete signature?" subtitle="This removes it from your library. Copies already pasted into mail apps keep working." width={440}
        footer={<><button className="btn btn-line" onClick={() => setConfirm(null)}>Cancel</button><button className="btn bg-[#b91c1c] text-white hover:bg-[#991b1b]" onClick={() => { deleteSignature(confirm!); setConfirm(null); toast('Signature deleted') }}>Delete</button></>}>
        <p className="text-sm text-muted">“{signatures.find((s) => s.id === confirm)?.label}” will be removed.</p>
      </Modal>
    </>
  )
}

function MenuItem({ children, icon, onClick, danger }: { children: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition hover:bg-paper-2 ${danger ? 'text-[#b91c1c]' : ''}`}>
      {icon}{children}
    </button>
  )
}
