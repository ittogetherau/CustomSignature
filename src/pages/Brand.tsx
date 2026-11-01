import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useImageUpload } from '../components/upload'
import { ImagePlus, Trash2, Wand2 } from 'lucide-react'
import { useStore } from '../store'
import type { BrandKit, Employee, SocialKey } from '../types'
import { FONTS, SOCIAL_LABEL, renderSignature } from '../lib/render'
import { TEMPLATES } from '../lib/templates'
import { brandColors } from '../lib/io'
import { employeeSignature } from './Team'
import { ColorInput, Field, PageHeader, SigThumb, Toggle, useToast } from '../components/ui'

export default function Brand() {
  const store = useStore()
  const toast = useToast()
  const [b, setB] = useState<BrandKit>(store.brand)
  const upload = useImageUpload()
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(b) !== JSON.stringify(store.brand)
  const set = <K extends keyof BrandKit>(k: K, v: BrandKit[K]) => setB({ ...b, [k]: v })

  const sample: Employee = store.employees[0] ?? { id: 'preview', fullName: 'Alex Morgan', title: 'Your job title', department: '', email: `alex@${(b.website || 'company.com').replace(/^https?:\/\//, '')}`, phone: b.phone, photo: '', templateId: null, status: 'active', source: 'manual', externalId: null, updatedAt: Date.now() }
  const preview = renderSignature(employeeSignature({ ...sample, templateId: b.defaultTemplateId }, b, null), { campaigns: store.campaigns })

  return (
    <>
      <PageHeader
        eyebrow="Company settings"
        title="Brand kit"
        subtitle={store.role === 'member' ? 'Only workspace admins can change the brand kit.' : 'Set it once. Every team signature pulls its logo, colours, links and legal text from here.'}
        actions={<>
          <button className="btn btn-line" disabled={!dirty} onClick={() => setB(store.brand)}>Discard</button>
          <button className="btn btn-ink" disabled={!dirty || store.role === 'member'} title={store.role === 'member' ? 'Only admins can change the brand kit' : undefined} onClick={() => { store.setBrand(b); toast('Brand kit saved — team signatures updated') }}>Save changes</button>
        </>}
      />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="h-display mb-4 text-xl">Identity</h2>
            <div className="mb-4 flex items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                {b.logo ? <img src={b.logo} alt="" className="size-full object-contain p-2" /> : <ImagePlus className="text-faint" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-line btn-sm" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? <Loader2 size={14} className="animate-spin" /> : b.logo ? 'Replace logo' : 'Upload logo'}</button>
                {b.logo && <button className="btn btn-ghost btn-sm" onClick={async () => { const c = await brandColors(b.logo); if (c.length) { setB({ ...b, primary: c[0], accent: c[1] ?? b.accent }); toast('Colours pulled from logo') } }}><Wand2 size={14} /> Match colours</button>}
                {b.logo && <button className="btn btn-ghost btn-sm btn-icon" onClick={() => set('logo', '')} aria-label="Remove logo"><Trash2 size={14} /></button>}
              </div>
              <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); const u = await upload(f, 'logo', 480); setUploading(false); if (u) set('logo', u) }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name"><input className="input" value={b.company} onChange={(e) => set('company', e.target.value)} /></Field>
              <Field label="Website"><input className="input" value={b.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Main phone"><input className="input" value={b.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Address"><input className="input" value={b.address} onChange={(e) => set('address', e.target.value)} /></Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="h-display mb-4 text-xl">Look & feel</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorInput label="Primary colour" value={b.primary} onChange={(v) => set('primary', v)} />
              <ColorInput label="Accent colour" value={b.accent} onChange={(v) => set('accent', v)} />
              <Field label="Font"><select className="input" value={b.font} onChange={(e) => set('font', e.target.value)}>{FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></Field>
              <Field label="Default template"><select className="input" value={b.defaultTemplateId} onChange={(e) => set('defaultTemplateId', e.target.value)}>{TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="h-display mb-4 text-xl">Company socials</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SOCIAL_LABEL) as SocialKey[]).map((k) => (
                <Field key={k} label={SOCIAL_LABEL[k]}><input className="input" value={b.socials[k] ?? ''} onChange={(e) => set('socials', { ...b.socials, [k]: e.target.value })} /></Field>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="h-display mb-1 text-xl">Link click analytics</h2>
            <p className="mb-4 text-sm text-muted">Count clicks on website, social, button and banner links in signatures copied, downloaded or emailed from Inkwell. Records link, time, approximate location, device and mail app — never IP addresses, and no open-tracking pixels.</p>
            <Toggle on={b.trackClicks !== false} onChange={(v) => set('trackClicks', v)} label="Track link clicks" desc="Applies to signatures shared after you save. Reinstall to stop tracking existing ones." />
          </section>

          <section className="card p-5">
            <h2 className="h-display mb-1 text-xl">Legal & compliance</h2>
            <p className="mb-4 text-sm text-muted">Appended to every team signature.</p>
            <textarea className="input" rows={4} placeholder="This email and any attachments are confidential…" value={b.disclaimer} onChange={(e) => set('disclaimer', e.target.value)} />
          </section>
        </div>

        <aside className="card sticky top-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="text-sm font-semibold">Live team preview</span>
            <span className="text-xs text-muted">{sample?.fullName}</span>
          </div>
          <div className="bg-white p-6"><SigThumb html={preview} align="left" /></div>
          {dirty && <div className="border-t border-line bg-butter-soft px-5 py-2.5 text-xs font-medium text-[#6b4e0e]">Unsaved — {store.employees.length} team signatures will update when you save.</div>}
        </aside>
      </div>
    </>
  )
}
