// Exchange Online cmdlets over REST, with a delegated admin token (scope Exchange.Manage).
// This is the endpoint the ExchangeOnlineManagement v3 PowerShell module itself calls. Microsoft
// doesn't document it as a public API, so the onboarding page also offers the same steps as a
// PowerShell script (see src/lib/relayScript.ts) in case it changes.

export class ExchangeError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export type CmdletParams = Record<string, string | number | boolean | string[] | null>

export async function invoke<T = Record<string, unknown>>(token: string, tenant: string, upn: string, cmdlet: string, params: CmdletParams = {}): Promise<T[]> {
  const res = await fetch(`https://outlook.office365.com/adminapi/beta/${tenant}/InvokeCommand`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-ResponseFormat': 'json',
      'X-AnchorMailbox': `UPN:${upn}`,
      'X-ClientApplication': 'Inkwell',
    },
    body: JSON.stringify({ CmdletInput: { CmdletName: cmdlet, Parameters: params } }),
  })
  const text = await res.text()
  let body: { value?: T[]; error?: { message?: string; details?: { message?: string }[] } } = {}
  try { body = JSON.parse(text) } catch { /* non-JSON error page */ }
  if (!res.ok) {
    const msg = body.error?.details?.[0]?.message ?? body.error?.message ?? text.slice(0, 300) ?? `HTTP ${res.status}`
    throw new ExchangeError(`${cmdlet}: ${cleanMsg(msg)}`, res.status)
  }
  return body.value ?? []
}

/** Exchange wraps errors as "|Microsoft.Exchange...Exception|The real message". */
const cleanMsg = (m: string) => m.split('|').filter(Boolean).pop()?.trim() ?? m

/** Get-* that returns [] instead of throwing when the object doesn't exist. */
export async function find<T = Record<string, unknown>>(token: string, tenant: string, upn: string, cmdlet: string, identity: string): Promise<T | null> {
  try {
    return (await invoke<T>(token, tenant, upn, cmdlet, { Identity: identity }))[0] ?? null
  } catch (e) {
    if (e instanceof ExchangeError && /couldn't be found|not found|doesn't exist|ManagementObjectNotFound/i.test(e.message)) return null
    throw e
  }
}

// The names Inkwell owns in a tenant. Removal only ever touches these.
export const NAMES = {
  inbound: 'Inkwell - from signature relay',
  outbound: 'Inkwell - to signature relay',
  rule: 'Inkwell - route mail for signatures',
} as const
export const SIGNED_HEADER = 'X-Inkwell-Signed'
