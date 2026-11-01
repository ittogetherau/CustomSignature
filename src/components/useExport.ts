import { useStore } from '../store'
import { exportDocument, renderSignature } from '../lib/render'
import { registerLinks, trackHtml, trackingBase } from '../lib/tracking'
import type { Signature } from '../types'

/**
 * Everything that leaves the app (copy, download, email) goes through here so links are
 * tracked consistently when the workspace has click analytics on.
 */
export function useSignatureExport() {
  const { org, campaigns, brand } = useStore()
  const tracking = brand.trackClicks !== false

  return async (sig: Signature, personType: 'sig' | 'emp') => {
    const raw = renderSignature(sig, { campaigns })
    if (!tracking) return { html: raw, doc: exportDocument(sig, { campaigns }) }
    const target = { orgId: org.id, personType, personId: sig.id }
    const { html, links } = trackHtml(raw, sig, target, trackingBase(), campaigns)
    try {
      await registerLinks(target, links)
    } catch (e) {
      // Never break copy/send over analytics: fall back to the original, untracked links.
      console.warn(e)
      return { html: raw, doc: exportDocument(sig, { campaigns }) }
    }
    return { html, doc: exportDocument(sig, { campaigns }, html) }
  }
}
