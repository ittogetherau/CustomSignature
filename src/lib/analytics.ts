// There is no tracking backend, so analytics are a deterministic simulation
// derived from each signature's totals. Same input → same chart on every load.

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export interface DayPoint { date: string; label: string; impressions: number; clicks: number }

export function series(days: number, totalImpressions: number, totalClicks: number, seed = 7): DayPoint[] {
  const r = rng(seed)
  const weights = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000)
    const weekday = d.getDay() === 0 || d.getDay() === 6 ? 0.45 : 1
    return weekday * (0.75 + r() * 0.5) * (1 + i / days / 2)
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  return weights.map((w, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000)
    const impressions = Math.round((w / sum) * totalImpressions)
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      impressions,
      clicks: Math.round(impressions * (totalClicks / Math.max(totalImpressions, 1)) * (0.8 + r() * 0.4)),
    }
  })
}

export const LINK_BREAKDOWN = [
  { name: 'Website', share: 0.31 },
  { name: 'Campaign banner', share: 0.26 },
  { name: 'LinkedIn', share: 0.17 },
  { name: 'Book a call', share: 0.12 },
  { name: 'Instagram', share: 0.08 },
  { name: 'Email / phone', share: 0.06 },
]

export const CLIENTS = [
  { name: 'Gmail', share: 0.46 },
  { name: 'Outlook', share: 0.29 },
  { name: 'Apple Mail', share: 0.18 },
  { name: 'Other', share: 0.07 },
]
