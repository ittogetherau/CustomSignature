import { admin } from './_lib/microsoft.js'

// GET /r/<code> (rewritten to /api/r?code=<code>) — record a signature link click, then forward.
// Location comes from Vercel's edge headers; the IP address itself is never stored.

const SCANNERS = /bot|crawler|spider|preview|scanner|safelinks|safe links|mimecast|proofpoint|barracuda|symantec|forcepoint|trendmicro|sophos|fortinet|cisco|ironport|zscaler|headless|python-requests|curl|wget|go-http-client|okhttp|java\/|libwww|facebookexternalhit|slackbot|linkedinbot|whatsapp|telegrambot|discordbot|microsoft office|ms-office|outlook-ios-android\/.*preview/i

function device(ua: string) {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

function client(ua: string) {
  if (/outlook|microsoft outlook|olk/i.test(ua)) return 'Outlook'
  if (/gmail|googleimageproxy|gsa\//i.test(ua)) return 'Gmail'
  if (/applewebkit/i.test(ua) && /mac os x|iphone|ipad/i.test(ua) && !/chrome|crios|edg|firefox/i.test(ua)) return 'Apple Mail / Safari'
  if (/edg\//i.test(ua)) return 'Edge'
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  return 'Other'
}

const decode = (v: string | null) => {
  if (!v) return null
  try { return decodeURIComponent(v) } catch { return v }
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') ?? ''
  const fallback = new URL('/', req.url).toString()
  if (!/^[a-z0-9]{6,32}$/i.test(code)) return Response.redirect(fallback, 302)

  try {
    const db = admin()
    const { data: link } = await db.from('links').select('code, org_id, person_type, person_id, kind, url').eq('code', code).maybeSingle()
    if (!link) return Response.redirect(fallback, 302)

    const ua = req.headers.get('user-agent') ?? ''
    const h = (k: string) => decode(req.headers.get(k))
    // Await the insert: serverless functions may freeze as soon as the response is returned.
    await db.from('clicks').insert({
      org_id: link.org_id,
      link_code: link.code,
      person_type: link.person_type,
      person_id: link.person_id,
      kind: link.kind,
      url: link.url,
      country: h('x-vercel-ip-country'),
      region: h('x-vercel-ip-country-region'),
      city: h('x-vercel-ip-city'),
      device: device(ua),
      client: client(ua),
      is_bot: !ua || SCANNERS.test(ua),
    })
    return new Response(null, { status: 302, headers: { Location: link.url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  } catch {
    return Response.redirect(fallback, 302)
  }
}

// Link scanners often probe with HEAD; forward without counting.
export async function HEAD(req: Request) {
  const code = new URL(req.url).searchParams.get('code') ?? ''
  try {
    const { data } = await admin().from('links').select('url').eq('code', code).maybeSingle()
    return new Response(null, { status: 302, headers: { Location: data?.url ?? '/' } })
  } catch {
    return new Response(null, { status: 302, headers: { Location: '/' } })
  }
}
