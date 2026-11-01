import { useState } from 'react'
import { Archive, CornerUpLeft, Forward, Monitor, Moon, MoreHorizontal, Smartphone, Star, Sun, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { SigThumb, SignatureHTML } from './ui'

/** A neutral mail-reader frame so people see the signature where it will actually live. */
export default function EmailPreview({ html, fromName, fromEmail }: { html: string; fromName: string; fromEmail: string }) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [dark, setDark] = useState(false)

  const first = fromName.split(' ')[0] || 'there'
  const frame = dark ? 'bg-[#1f1d1b] text-[#e7e5e4] border-[#3a3633]' : 'bg-white text-ink border-line'
  const sub = dark ? 'text-[#a8a29e]' : 'text-muted'

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="seg">
          <button data-on={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={13} /> Desktop</button>
          <button data-on={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={13} /> Mobile</button>
        </div>
        <div className="seg">
          <button data-on={!dark} onClick={() => setDark(false)} aria-label="Light inbox"><Sun size={13} /></button>
          <button data-on={dark} onClick={() => setDark(true)} aria-label="Dark inbox"><Moon size={13} /></button>
        </div>
      </div>

      <div className={clsx('mx-auto w-full transition-all duration-500', device === 'mobile' ? 'max-w-[390px]' : 'max-w-[760px]')}>
        <div className={clsx('overflow-hidden border shadow-lift transition-colors', frame, device === 'mobile' ? 'rounded-[34px] border-[10px] !border-ink' : 'rounded-2xl')}>
          {device === 'desktop' ? (
            <div className={clsx('flex items-center gap-1.5 border-b px-4 py-2.5', dark ? 'border-[#3a3633] bg-[#262321]' : 'border-line bg-paper/60')}>
              <span className="size-2.5 rounded-full bg-[#ec6a5e]" /><span className="size-2.5 rounded-full bg-[#f4bf4f]" /><span className="size-2.5 rounded-full bg-[#61c554]" />
              <div className={clsx('ml-4 flex gap-3', sub)}>
                <Archive size={14} /><Trash2 size={14} /><Star size={14} />
              </div>
              <MoreHorizontal size={14} className={clsx('ml-auto', sub)} />
            </div>
          ) : (
            <div className="flex justify-center pt-2"><span className="h-5 w-24 rounded-full bg-ink" /></div>
          )}

          <div className={clsx(device === 'mobile' ? 'px-4 py-4' : 'px-7 py-6')}>
            <div className={clsx('font-semibold', device === 'mobile' ? 'text-lg' : 'text-xl')}>Re: Proposal for Q1 rollout</div>
            <div className="mt-4 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-clay text-sm font-bold text-white">{first[0]}</div>
              <div className="min-w-0 text-sm">
                <div className="font-semibold">{fromName} <span className={clsx('font-normal', sub)}>&lt;{fromEmail}&gt;</span></div>
                <div className={clsx('text-xs', sub)}>to Jordan · 10:42 AM</div>
              </div>
            </div>

            <div className={clsx('mt-5 space-y-3 text-[14px] leading-relaxed', dark ? 'text-[#d6d3d1]' : 'text-ink-3')}>
              <p>Hi Jordan,</p>
              <p>Thanks for the quick turnaround. I've attached the revised timeline — happy to jump on a call this week if anything needs a second look.</p>
              <p>Best,</p>
            </div>

            <div className={clsx('mt-4 rounded-xl', dark && 'bg-white p-4')}>
              {device === 'mobile' ? <SigThumb html={html} align="left" /> : <div className="overflow-x-auto"><SignatureHTML html={html} /></div>}
            </div>

            <div className="mt-7 flex gap-2">
              <span className={clsx('btn btn-sm', dark ? 'border border-[#3a3633]' : 'btn-line')}><CornerUpLeft size={13} /> Reply</span>
              <span className={clsx('btn btn-sm', dark ? 'border border-[#3a3633]' : 'btn-line')}><Forward size={13} /> Forward</span>
            </div>
          </div>
        </div>
        {dark && <p className="mt-3 text-center text-xs text-muted">Most dark-mode mail apps keep signatures on a light surface — previewed the same way here.</p>}
      </div>
    </div>
  )
}
