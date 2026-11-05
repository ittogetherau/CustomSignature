// Renders a signature for a fake employee through the same code path as /api/relay/signature
// (minus the database) and checks the output. Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { buildRelaySignature, relaySkipReason, RELAY_TRACKING_BASE } from '../src/lib/relaySignature'
import { linkCode } from '../src/lib/trackingCore'
import type { BrandKit, Campaign, Employee } from '../src/types'

const ORG = '11111111-1111-4111-8111-111111111111'

const employee: Employee = {
  id: '22222222-2222-4222-8222-222222222222', fullName: 'Ada Lovelace', title: 'Head of Engines', department: 'Engineering',
  email: 'ada@example.com', phone: '+61 400 000 000', photo: '', templateId: null, status: 'active', source: 'microsoft',
  externalId: null, updatedAt: Date.parse('2026-11-01T00:00:00Z'),
}

const brand: Partial<BrandKit> = {
  company: 'Analytical Co', website: 'analytical.example', disclaimer: 'Confidential.', defaultTemplateId: 'aurora',
  socials: { linkedin: 'https://www.linkedin.com/company/analytical' }, trackClicks: true,
}

const banner: Campaign = {
  id: 'c1', name: 'Launch', headline: 'Meet the Difference Engine', subline: '', ctaLabel: 'Learn more', url: 'https://analytical.example/engine',
  image: '', style: 'gradient', from: '#000000', to: '#ffffff', start: '', end: '', departments: ['engineering'], active: true,
}

test('renders a tracked signature for the sender', () => {
  const out = buildRelaySignature({ orgId: ORG, brand, employee, campaigns: [banner] })
  assert.ok(out.html.startsWith('<div data-inkwell-sig>') && out.html.endsWith('</div>'))
  assert.ok(out.html.includes('Ada Lovelace'), 'html has the name')
  assert.ok(out.html.includes(`href="${RELAY_TRACKING_BASE}/r/`), 'html has tracked links')
  assert.ok(!/href="https?:\/\/(?!inkwell\.ittogether\.com\.au\/r\/)/i.test(out.html), 'no untracked http(s) links remain')
  assert.ok(out.links.length > 0)
  const target = { orgId: ORG, personType: 'emp' as const, personId: employee.id }
  const website = out.links.find((l) => l.url.startsWith('https://analytical.example') && l.kind === 'Website')
  assert.ok(website, 'website link registered')
  assert.equal(website.code, linkCode(target, website.url))
  assert.ok(out.links.some((l) => l.kind === 'Banner: Launch'), 'banner link registered')

  assert.match(out.text, /^Ada Lovelace$/m)
  assert.match(out.text, /Head of Engines, Engineering/)
  assert.match(out.text, /Analytical Co/)
  assert.match(out.text, /E: ada@example\.com/)
  assert.match(out.text, /Meet the Difference Engine/)
  assert.ok(out.text.includes(`${RELAY_TRACKING_BASE}/r/`), 'text uses tracked links')
  assert.match(out.text, /Confidential\.$/)
})

test('leaves links alone when click tracking is off', () => {
  const out = buildRelaySignature({ orgId: ORG, brand: { ...brand, trackClicks: false }, employee, campaigns: [] })
  assert.equal(out.links.length, 0)
  assert.ok(!out.html.includes('/r/'))
  assert.ok(out.html.includes('Ada Lovelace'))
})

test('scope decides who gets a signature', () => {
  const sender = 'ADA@example.com'
  assert.equal(relaySkipReason(null, null, sender), 'no_employee')
  assert.equal(relaySkipReason(null, employee, sender), 'not_test_sender')
  assert.equal(relaySkipReason({ mode: 'test', testEmails: ['ada@example.com'] }, employee, sender), null)
  assert.equal(relaySkipReason({ mode: 'all', paused: true }, employee, sender), 'paused')
  assert.equal(relaySkipReason({ mode: 'departments', departments: ['Sales'] }, employee, sender), 'department_not_enabled')
  assert.equal(relaySkipReason({ mode: 'departments', departments: [' engineering '] }, employee, sender), null)
  assert.equal(relaySkipReason({ mode: 'all' }, employee, sender), null)
})

test('relay requests are authenticated with HMAC-SHA256', async () => {
  process.env.RELAY_SECRET = 'test-secret'
  const { verify } = await import('../api/_lib/relay')
  const body = JSON.stringify({ tenantHost: 'contoso.mail.protection.outlook.com', sender: 'ada@example.com' })
  const sig = createHmac('sha256', 'test-secret').update(body).digest('hex')
  assert.equal(verify(body, sig), true)
  assert.equal(verify(body, `sha256=${sig.toUpperCase()}`), true)
  assert.equal(verify(body + ' ', sig), false)
  assert.equal(verify(body, null), false)
  assert.equal(verify(body, 'abc'), false)
})
