import { esc } from './render'

// Emails each staff member their personalised signature, sent as the signed-in user
// through Microsoft Graph (delegated Mail.Send) so it arrives from a real colleague.

export const MS_MAIL_SCOPES = 'openid profile email offline_access User.Read Mail.Send'

export interface SignatureEmail {
  to: string
  name: string
  subject: string
  note: string
  senderName: string
  company: string
  signatureHtml: string
  attachmentHtml: string
}

const step = (n: number, title: string, body: string) =>
  `<tr><td valign="top" style="padding:0 12px 14px 0;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:#1c1917;color:#fff;text-align:center;font:700 12px Segoe UI,Arial,sans-serif;">${n}</div></td><td valign="top" style="padding:2px 0 14px;font:14px/1.55 Segoe UI,Arial,sans-serif;color:#374151;"><strong style="color:#111827;">${title}</strong><br />${body}</td></tr>`

export function buildSignatureEmail(e: Omit<SignatureEmail, 'subject'>) {
  const first = e.name.split(' ')[0] || 'there'
  const note = e.note.trim()
    ? esc(e.note.trim()).replace(/\n/g, '<br />')
    : `Your new ${esc(e.company)} email signature is ready. It takes about a minute to install — the steps are below.`
  return `<div style="font:14px/1.6 Segoe UI,Arial,sans-serif;color:#1f2937;max-width:640px;">
<p style="margin:0 0 14px;">Hi ${esc(first)},</p>
<p style="margin:0 0 18px;">${note}</p>
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Your signature</p>
<div style="border:2px dashed #d6d3d1;border-radius:14px;padding:22px;margin:0 0 22px;background:#ffffff;">${e.signatureHtml}</div>
<p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111827;">How to install it</p>
<table cellpadding="0" cellspacing="0" border="0" role="presentation">
${step(1, 'Copy the signature', 'Click just before the signature inside the dashed box, drag to select all of it, then press Ctrl+C (Cmd+C on Mac).')}
${step(2, 'Outlook on the web or new Outlook', 'Settings (gear) → Accounts → Signatures → + New signature → paste → choose it for new messages and replies → Save.')}
${step(3, 'Classic Outlook for Windows', 'File → Options → Mail → Signatures… → New → paste → set as default → OK.')}
${step(4, 'Outlook mobile', 'Settings → your account → Signature → paste. (Mobile apps may simplify the layout.)')}
${step(5, 'Gmail or Apple Mail', 'Gmail: Settings → See all settings → Signature → Create new → paste. Apple Mail: Settings → Signatures → + → paste.')}
</table>
<p style="margin:6px 0 18px;font-size:13px;color:#6b7280;">The signature is also attached as an HTML file if you prefer to open it in a browser and copy from there.</p>
<p style="margin:0;">Thanks,<br />${esc(e.senderName)}</p>
</div>`
}

const toBase64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const fileName = (name: string) => `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'signature'}-email-signature.html`

export class MailAuthNeeded extends Error {}

/** Send one email via Graph /me/sendMail. Throws MailAuthNeeded when the token lacks Mail.Send. */
export async function sendViaGraph(token: string, e: SignatureEmail) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: e.subject,
        body: { contentType: 'HTML', content: buildSignatureEmail(e) },
        toRecipients: [{ emailAddress: { address: e.to, name: e.name } }],
        attachments: [{ '@odata.type': '#microsoft.graph.fileAttachment', name: fileName(e.name), contentType: 'text/html', contentBytes: toBase64(e.attachmentHtml) }],
      },
      saveToSentItems: true,
    }),
  })
  if (res.status === 202) return
  if (res.status === 401 || res.status === 403) throw new MailAuthNeeded()
  const body = await res.json().catch(() => null)
  throw new Error(body?.error?.message ?? `Microsoft returned ${res.status}`)
}
