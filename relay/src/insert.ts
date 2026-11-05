/**
 * Pure signature insertion. No I/O, no MIME: takes decoded HTML / plain text
 * bodies and returns new bodies with the signature placed above the quoted
 * reply (or at the end of a new message).
 */

export interface Bodies {
  html?: string;
  text?: string;
}

export interface Signature {
  html: string;
  text: string;
}

export interface InsertResult extends Bodies {
  /** true when at least one body was changed */
  changed: boolean;
}

export const SIG_ATTR = 'data-inkwell-sig';

/** Patterns that mark the start of the quoted / forwarded part in HTML. */
const HTML_REPLY_MARKERS: RegExp[] = [
  // Outlook desktop / web: <div id="appendonsend"></div>
  /\bid\s*=\s*["']?appendonsend\b/i,
  // Outlook desktop / web: <div id="divRplyFwdMsg">
  /\bid\s*=\s*["']?divRplyFwdMsg\b/i,
  // Outlook web separator: <hr style="display:inline-block;width:98%" ...>
  /<hr\b[^>]*style\s*=\s*["'][^"']*display\s*:\s*inline-block\s*;\s*width\s*:\s*98%/i,
  // iOS / macOS Mail
  /<blockquote\b[^>]*\btype\s*=\s*["']?cite\b/i,
  // Gmail (newer builds wrap gmail_quote in gmail_quote_container)
  /\bclass\s*=\s*["'][^"']*\bgmail_quote(?:_container)?\b/i,
];

const OUTLOOK_MOBILE_SIG = /\bid\s*=\s*["']?ms-outlook-mobile-signature\b/i;

/** Plain-text reply markers, matched at the start of a line. */
const TEXT_REPLY_MARKERS: RegExp[] = [/^From:/m, /^-{2,}\s*Original Message\s*-{2,}/im];

const OUTLOOK_MOBILE_TEXT = /^[ \t]*Get Outlook for (?:iOS|Android)\b.*(?:\r?\n|$)/im;

function wrapHtml(sig: string): string {
  return `<div ${SIG_ATTR}="1">${sig}</div>`;
}

/** Index of the `<` that opens the tag containing position `idx`. */
function tagStart(html: string, idx: number): number {
  if (html[idx] === '<') return idx;
  const lt = html.lastIndexOf('<', idx);
  return lt === -1 ? idx : lt;
}

/** Earliest match position (tag start) of any of the patterns, or -1. */
function firstMarker(html: string, patterns: RegExp[]): number {
  let best = -1;
  for (const re of patterns) {
    const m = re.exec(html);
    if (!m) continue;
    const pos = tagStart(html, m.index);
    if (best === -1 || pos < best) best = pos;
  }
  return best;
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

/**
 * Given the index of an opening tag, return the index just past its matching
 * close tag (depth-counted on the same tag name). Falls back to the end of the
 * opening tag when no close tag is found.
 */
export function elementEnd(html: string, start: number): number {
  const open = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(start, start + 64));
  const openEnd = html.indexOf('>', start);
  if (!open || openEnd === -1) return openEnd === -1 ? html.length : openEnd + 1;
  const name = open[1].toLowerCase();
  if (VOID_ELEMENTS.has(name) || html[openEnd - 1] === '/') return openEnd + 1;
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) depth--;
    else if (!m[0].endsWith('/>')) depth++;
    if (depth === 0) return m.index + m[0].length;
  }
  return openEnd + 1;
}

export function insertHtml(html: string, sig: string): string | null {
  const reply = firstMarker(html, HTML_REPLY_MARKERS);
  const newPart = reply === -1 ? html : html.slice(0, reply);
  if (newPart.toLowerCase().includes(SIG_ATTR)) return null;

  // Outlook mobile: replace its "Get Outlook for iOS" signature block when it
  // sits in the new-message part.
  const mob = OUTLOOK_MOBILE_SIG.exec(newPart);
  if (mob) {
    const start = tagStart(html, mob.index);
    const end = elementEnd(html, start);
    return html.slice(0, start) + wrapHtml(sig) + html.slice(end);
  }

  if (reply !== -1) {
    return html.slice(0, reply) + wrapHtml(sig) + html.slice(reply);
  }

  const bodyClose = html.toLowerCase().lastIndexOf('</body');
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + wrapHtml(sig) + html.slice(bodyClose);
  }
  return html + wrapHtml(sig);
}

export function insertText(text: string, sig: string): string | null {
  const nl = text.includes('\r\n') ? '\r\n' : '\n';
  const sigText = sig.replace(/\r?\n/g, nl).replace(/\s+$/, '');
  if (!sigText) return null;

  let reply = -1;
  for (const re of TEXT_REPLY_MARKERS) {
    const m = re.exec(text);
    if (m && (reply === -1 || m.index < reply)) reply = m.index;
  }

  if (reply !== -1) {
    // Outlook puts a line of underscores right above "From:". Keep it with the quote.
    const before = text.slice(0, reply);
    const sep = /(?:^|\r?\n)[ \t]*_{10,}[ \t]*\r?\n$/.exec(before);
    if (sep) reply = sep.index + (before[sep.index] === '\r' ? 2 : before[sep.index] === '\n' ? 1 : 0);
  }

  let newPart = reply === -1 ? text : text.slice(0, reply);
  const rest = reply === -1 ? '' : text.slice(reply);

  if (newPart.includes(sigText)) return null;
  newPart = newPart.replace(OUTLOOK_MOBILE_TEXT, '');

  const head = newPart.replace(/\s+$/, '');
  const block = (head ? head + nl + nl : '') + sigText + nl;
  return rest ? block + nl + rest : block;
}

export function insertSignature(bodies: Bodies, sig: Signature): InsertResult {
  const out: InsertResult = { ...bodies, changed: false };
  if (bodies.html !== undefined && sig.html) {
    const r = insertHtml(bodies.html, sig.html);
    if (r !== null) {
      out.html = r;
      out.changed = true;
    }
  }
  if (bodies.text !== undefined && sig.text) {
    const r = insertText(bodies.text, sig.text);
    if (r !== null) {
      out.text = r;
      out.changed = true;
    }
  }
  return out;
}
