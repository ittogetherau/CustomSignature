import { supabase } from './supabase'
import { linkRows, type TrackTarget, type TrackedLink } from './trackingCore'

export { linkCode, linkKind, linkRows, trackHtml, type TrackTarget, type TrackedLink } from './trackingCore'

/** Register links so the redirect endpoint can resolve them. Safe to call repeatedly. */
export async function registerLinks(t: TrackTarget, links: TrackedLink[]) {
  if (!links.length) return
  const { error } = await supabase.from('links').upsert(
    linkRows(t, links),
    { onConflict: 'code', ignoreDuplicates: true },
  )
  if (error) throw new Error(`Couldn't prepare tracked links: ${error.message}`)
}

/** Public base for tracked links — the domain the app is served from (custom domain in production). */
export const trackingBase = () => location.origin
