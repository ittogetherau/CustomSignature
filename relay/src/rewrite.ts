/**
 * Streaming MIME rewrite. Only the first text/html and the first text/plain
 * body parts are decoded, changed and re-encoded; every other byte of the
 * message is passed through unchanged by mailsplit.
 */
import { Transform, type Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mailsplit from '@zone-eu/mailsplit';
import iconv from 'iconv-lite';
import { insertHtml, insertText, type Signature } from './insert.js';

const { Splitter, Joiner, Rewriter } = mailsplit;
type MimeNode = InstanceType<typeof mailsplit.MimeNode>;

export const SIGNED_HEADER = 'X-Inkwell-Signed';

/** Text parts bigger than this are passed through instead of being buffered. */
const MAX_TEXT_PART = 10 * 1024 * 1024;

export type ClientKind =
  | 'outlook-desktop'
  | 'outlook-mac'
  | 'outlook-mobile'
  | 'apple-mail'
  | 'gmail'
  | 'thunderbird'
  | 'other';

export interface RewriteResult {
  /** a signature was inserted into at least one part */
  signed: boolean;
  /** why nothing was inserted, when signed is false */
  reason?: 'no-signature' | 'secure' | 'already-signed' | 'no-body' | 'duplicate';
  client: ClientKind;
}

const SECURE_TYPES = new Set([
  'multipart/signed',
  'multipart/encrypted',
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
]);

export function detectClient(xMailer: string, userAgent: string): ClientKind {
  const s = `${xMailer} ${userAgent}`.toLowerCase();
  if (/outlook-(ios|android)|outlook for (ios|android)/.test(s)) return 'outlook-mobile';
  if (/microsoft outlook/.test(s) && /mac/.test(s)) return 'outlook-mac';
  if (/microsoft outlook|microsoft office outlook/.test(s)) return 'outlook-desktop';
  if (/iphone mail|ipad mail|apple mail/.test(s)) return 'apple-mail';
  if (/thunderbird/.test(s)) return 'thunderbird';
  if (/gmail|google/.test(s)) return 'gmail';
  return 'other';
}

function insideAttachedMessage(node: MimeNode): boolean {
  let p = node.parentNode as MimeNode | false;
  while (p) {
    if (p.rfc822) return true;
    p = p.parentNode as MimeNode | false;
  }
  return false;
}

function decodeCharset(buf: Buffer, charset: string | false): string | null {
  const cs = (charset || '').trim().toLowerCase();
  if (!cs || cs === 'us-ascii' || cs === 'ascii') {
    // Unlabelled 8-bit data: assume UTF-8 and fall back to windows-1252.
    const s = buf.toString('utf8');
    return s.includes('�') ? iconv.decode(buf, 'windows-1252') : s;
  }
  if (cs === 'utf-8' || cs === 'utf8') return buf.toString('utf8');
  if (!iconv.encodingExists(cs)) return null;
  return iconv.decode(buf, cs);
}

/** Point any <meta> charset declaration at UTF-8 to match the new Content-Type. */
function fixMetaCharset(html: string): string {
  return html.replace(/(<meta\b[^>]*?\bcharset\s*=\s*["']?)([\w.:-]+)/gi, '$1utf-8');
}

/**
 * Rewrite a raw RFC 5322 message from `input` to `output`.
 * `sig === null` means pass-through: only the X-Inkwell-Signed header is added.
 */
export async function rewriteMessage(
  input: Readable,
  output: Writable,
  sig: Signature | null,
): Promise<RewriteResult> {
  const result: RewriteResult = { signed: false, client: 'other' };
  let secure = false;
  let alreadySigned = false;
  let htmlDone = false;
  let textDone = false;
  let sawBody = false;
  let duplicate = false;

  const splitter = new Splitter({ ignoreEmbedded: true });
  const joiner = new Joiner();

  const rewriter = new Rewriter((node: MimeNode) => {
    if (node.root) {
      if (!node.headers) node.parseHeaders();
      const h = node.headers as InstanceType<typeof mailsplit.Headers>;
      result.client = detectClient(h.getFirst('x-mailer'), h.getFirst('user-agent'));
      alreadySigned = h.hasHeader(SIGNED_HEADER.toLowerCase());
      secure = SECURE_TYPES.has((node.contentType || '').toLowerCase());
    }
    if (!sig || secure || alreadySigned) return false;
    if (node.multipart || insideAttachedMessage(node)) return false;
    if (node.disposition === 'attachment') return false;
    const ct = (node.contentType || 'text/plain').toLowerCase();
    if (ct === 'text/html' && !htmlDone && sig.html) {
      htmlDone = true;
      sawBody = true;
      return true;
    }
    if (ct === 'text/plain' && !textDone && sig.text) {
      textDone = true;
      sawBody = true;
      return true;
    }
    return false;
  });

  rewriter.on('node', ({ node, decoder, encoder }) => {
    const isHtml = (node.contentType || '').toLowerCase() === 'text/html';
    let chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;

    decoder.on('data', (chunk: Buffer) => {
      if (overflow) {
        encoder.write(chunk);
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
      if (size > MAX_TEXT_PART) {
        overflow = true;
        encoder.write(Buffer.concat(chunks));
        chunks = [];
      }
    });
    decoder.on('error', (err: Error) => rewriter.destroy(err));
    decoder.on('end', () => {
      if (overflow) {
        encoder.end();
        return;
      }
      const original = Buffer.concat(chunks);
      try {
        const str = decodeCharset(original, node.charset);
        const changed = str === null ? null : isHtml ? insertHtml(str, sig!.html) : insertText(str, sig!.text);
        if (changed === null) {
          if (str !== null) duplicate = true;
          encoder.end(original);
          return;
        }
        node.setCharset('utf-8');
        encoder.end(Buffer.from(isHtml ? fixMetaCharset(changed) : changed, 'utf8'));
        result.signed = true;
      } catch (err) {
        rewriter.destroy(err as Error);
      }
    });
  });

  let first = true;
  const prepend = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      if (first) {
        first = false;
        if (!alreadySigned) this.push(Buffer.from(`${SIGNED_HEADER}: 1\r\n`));
      }
      cb(null, chunk);
    },
    flush(cb) {
      if (first && !alreadySigned) this.push(Buffer.from(`${SIGNED_HEADER}: 1\r\n`));
      cb();
    },
  });

  await pipeline(input, splitter, rewriter, joiner, prepend, output);

  if (!result.signed) {
    result.reason = !sig
      ? 'no-signature'
      : secure
        ? 'secure'
        : alreadySigned
          ? 'already-signed'
          : duplicate
            ? 'duplicate'
            : sawBody
              ? 'duplicate'
              : 'no-body';
  }
  return result;
}

/** Read just the header block of a raw message (for logging / client detection on fail-open). */
export function parseHeaderBlock(head: Buffer): Map<string, string> {
  const end = head.indexOf('\r\n\r\n');
  const text = (end === -1 ? head : head.subarray(0, end)).toString('latin1').replace(/\r?\n[ \t]+/g, ' ');
  const map = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) {
      const k = line.slice(0, i).trim().toLowerCase();
      if (!map.has(k)) map.set(k, line.slice(i + 1).trim());
    }
  }
  return map;
}
