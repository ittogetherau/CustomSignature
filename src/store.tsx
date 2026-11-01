import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { BrandKit, Campaign, Employee, Signature } from './types'
import { samplePhoto, signatureFromTemplate, uid } from './lib/templates'

interface State {
  signatures: Signature[]
  employees: Employee[]
  campaigns: Campaign[]
  brand: BrandKit
}

interface Store extends State {
  saveSignature: (s: Signature) => void
  deleteSignature: (id: string) => void
  duplicateSignature: (id: string) => Signature | undefined
  upsertEmployees: (list: Employee[]) => void
  updateEmployee: (id: string, patch: Partial<Employee>) => void
  deleteEmployees: (ids: string[]) => void
  saveCampaign: (c: Campaign) => void
  deleteCampaign: (id: string) => void
  setBrand: (b: BrandKit) => void
  reset: () => void
}

const KEY = 'inkwell.v2'
const DAY = 86_400_000

const isoDay = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)

function seed(): State {
  const brand: BrandKit = {
    company: 'Brightwave Studio',
    website: 'brightwave.studio',
    logo: '',
    primary: '#0f766e',
    accent: '#e2643b',
    font: 'Helvetica, Arial, sans-serif',
    address: '120 Harbour St, Sydney NSW 2000',
    phone: '+61 2 9000 1234',
    disclaimer: '',
    defaultTemplateId: 'aurora',
    socials: { linkedin: 'linkedin.com/company/brightwave', instagram: 'instagram.com/brightwave', x: 'x.com/brightwave' },
  }

  const campaigns: Campaign[] = [
    { id: 'c1', name: 'Summit 2026 webinar', headline: 'Join the Brand Summit — Nov 20', subline: 'Live workshop on email-first marketing. Free seats left.', ctaLabel: 'Save my seat', url: 'brightwave.studio/summit', image: '', style: 'gradient', from: '#e2643b', to: '#f3a55b', start: isoDay(-6), end: isoDay(19), departments: ['Marketing', 'Sales'], active: true, impressions: 18420, clicks: 1166 },
    { id: 'c2', name: 'Case study: Northwind', headline: 'How Northwind grew replies 42%', subline: 'Read the 3-minute case study', ctaLabel: 'Read story', url: 'brightwave.studio/northwind', image: '', style: 'dark', from: '#0f766e', to: '#0f766e', start: isoDay(-30), end: isoDay(30), departments: [], active: true, impressions: 9210, clicks: 482 },
    { id: 'c3', name: 'Holiday hours', headline: 'Our studio closes Dec 24 – Jan 2', subline: 'Urgent support stays available 24/7.', ctaLabel: '', url: 'brightwave.studio/support', image: '', style: 'light', from: '#0f766e', to: '#0f766e', start: isoDay(50), end: isoDay(63), departments: [], active: false, impressions: 0, clicks: 0 },
  ]

  const s1 = signatureFromTemplate('aurora', { fullName: 'Om Raut', title: 'Founder & Director', company: 'Brightwave Studio', address: '' }, 3)
  s1.label = 'Primary — Om'
  s1.extras.campaignId = 'c1'
  s1.stats = { impressions: 12840, clicks: 914 }
  const s2 = signatureFromTemplate('executive', { fullName: 'Om Raut', title: 'Director', company: 'Brightwave Studio' }, 3)
  s2.label = 'Formal — Clients'
  s2.stats = { impressions: 5320, clicks: 241 }
  const s3 = signatureFromTemplate('compact', { fullName: 'Om Raut', title: 'Director', company: 'Brightwave' }, 3)
  s3.label = 'Replies & forwards'
  s3.stats = { impressions: 20110, clicks: 388 }
  s2.updatedAt -= DAY * 2
  s3.updatedAt -= DAY * 6

  const people: [string, string, string][] = [
    ['Sarah Chen', 'Marketing Lead', 'Marketing'],
    ['James Okafor', 'Account Executive', 'Sales'],
    ['Mia Rossi', 'Product Designer', 'Design'],
    ['Liam Patel', 'Customer Success', 'Support'],
    ['Ava Thompson', 'HR Business Partner', 'People'],
    ['Noah Williams', 'Sales Director', 'Sales'],
    ['Zara Ahmed', 'Content Strategist', 'Marketing'],
    ['Ethan Brooks', 'IT Operations', 'Operations'],
    ['Chloe Martin', 'Support Specialist', 'Support'],
    ['Lucas Nguyen', 'Brand Designer', 'Design'],
  ]
  const employees: Employee[] = people.map(([fullName, title, department], i) => ({
    id: uid(),
    fullName,
    title,
    department,
    email: `${fullName.split(' ')[0].toLowerCase()}@brightwave.studio`,
    phone: `+61 4${String(10 + i).padStart(2, '0')} 555 ${String(100 + i * 7).slice(-3)}`,
    photo: i % 3 === 2 ? '' : samplePhoto(i),
    templateId: i % 4 === 3 ? null : 'aurora',
    status: i === 4 || i === 8 ? 'invited' : i === 6 ? 'outdated' : 'active',
    updatedAt: Date.now() - i * DAY,
  }))

  return { signatures: [s1, s2, s3], employees, campaigns, brand }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as State
  } catch {
    /* fall through to seed */
  }
  return seed()
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota exceeded — uploaded images are the usual cause; keep running in memory */
    }
  }, [state])

  const store = useMemo<Store>(() => {
    const patch = (fn: (s: State) => Partial<State>) => setState((s) => ({ ...s, ...fn(s) }))
    return {
      ...state,
      saveSignature: (sig) =>
        patch((s) => {
          const next = { ...sig, updatedAt: Date.now() }
          const exists = s.signatures.some((x) => x.id === sig.id)
          return { signatures: exists ? s.signatures.map((x) => (x.id === sig.id ? next : x)) : [next, ...s.signatures] }
        }),
      deleteSignature: (id) => patch((s) => ({ signatures: s.signatures.filter((x) => x.id !== id) })),
      duplicateSignature: (id) => {
        const src = state.signatures.find((x) => x.id === id)
        if (!src) return
        const copy: Signature = { ...structuredClone(src), id: uid(), label: `${src.label} (copy)`, createdAt: Date.now(), updatedAt: Date.now(), stats: { impressions: 0, clicks: 0 } }
        patch((s) => ({ signatures: [copy, ...s.signatures] }))
        return copy
      },
      upsertEmployees: (list) =>
        patch((s) => {
          const map = new Map(s.employees.map((e) => [e.email.toLowerCase(), e]))
          list.forEach((e) => map.set(e.email.toLowerCase(), { ...map.get(e.email.toLowerCase()), ...e }))
          return { employees: [...map.values()] }
        }),
      updateEmployee: (id, p) => patch((s) => ({ employees: s.employees.map((e) => (e.id === id ? { ...e, ...p, updatedAt: Date.now() } : e)) })),
      deleteEmployees: (ids) => patch((s) => ({ employees: s.employees.filter((e) => !ids.includes(e.id)) })),
      saveCampaign: (c) =>
        patch((s) => ({ campaigns: s.campaigns.some((x) => x.id === c.id) ? s.campaigns.map((x) => (x.id === c.id ? c : x)) : [c, ...s.campaigns] })),
      deleteCampaign: (id) =>
        patch((s) => ({
          campaigns: s.campaigns.filter((x) => x.id !== id),
          signatures: s.signatures.map((x) => (x.extras.campaignId === id ? { ...x, extras: { ...x.extras, campaignId: null } } : x)),
        })),
      setBrand: (brand) => patch(() => ({ brand })),
      reset: () => setState(seed()),
    }
  }, [state])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
