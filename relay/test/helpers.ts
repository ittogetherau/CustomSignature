import { createHash } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import mailsplit from '@zone-eu/mailsplit';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type Mail from 'nodemailer/lib/mailer/index.js';
import { rewriteMessage, type RewriteResult } from '../src/rewrite.js';
import type { Signature } from '../src/insert.js';

export const SIG: Signature = {
  html: '<table><tr><td><b>Jane Doe</b> &middot; IT Together</td></tr></table>',
  text: 'Jane Doe · IT Together',
};

export function compose(opts: Mail.Options): Promise<Buffer> {
  return new MailComposer(opts).compile().build();
}

export async function rewrite(raw: Buffer | string, sig: Signature | null = SIG): Promise<{ out: Buffer; result: RewriteResult }> {
  const sink = new PassThrough();
  const chunks: Buffer[] = [];
  sink.on('data', (c: Buffer) => chunks.push(c));
  // feed in small chunks to exercise streaming boundaries
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const pieces: Buffer[] = [];
  for (let i = 0; i < buf.length; i += 997) pieces.push(buf.subarray(i, i + 997));
  const result = await rewriteMessage(Readable.from(pieces), sink, sig);
  return { out: Buffer.concat(chunks), result };
}

export interface PartInfo {
  contentType: string;
  disposition: string | false;
  filename: string | false;
  charset: string | false;
  encoding: string | false;
  /** raw (still transfer-encoded) body bytes */
  raw: Buffer;
  sha256: string;
}

/** Split a message into its leaf parts, keeping raw encoded bodies. */
export async function parts(raw: Buffer): Promise<PartInfo[]> {
  const splitter = new mailsplit.Splitter({ ignoreEmbedded: true });
  const list: PartInfo[] = [];
  let current: { node: InstanceType<typeof mailsplit.MimeNode>; chunks: Buffer[] } | null = null;
  const flush = () => {
    if (!current) return;
    const n = current.node;
    const body = Buffer.concat(current.chunks);
    list.push({
      contentType: (n.contentType || 'text/plain').toLowerCase(),
      disposition: n.disposition,
      filename: n.filename,
      charset: n.charset,
      encoding: n.encoding,
      raw: body,
      sha256: createHash('sha256').update(body).digest('hex'),
    });
    current = null;
  };
  await new Promise<void>((resolve, reject) => {
    splitter.on('data', (d: any) => {
      if (d.type === 'node') {
        flush();
        if (!d.multipart) current = { node: d, chunks: [] };
      } else if (d.type === 'body' && current) {
        current.chunks.push(d.value);
      } else if (d.type === 'data') {
        flush();
      }
    });
    splitter.on('end', () => {
      flush();
      resolve();
    });
    splitter.on('error', reject);
    splitter.end(raw);
  });
  return list;
}

export function decode(p: PartInfo): string {
  let buf = p.raw;
  if (p.encoding === 'base64') buf = Buffer.from(buf.toString('ascii'), 'base64');
  else if (p.encoding === 'quoted-printable') {
    const s = buf.toString('latin1').replace(/=\r?\n/g, '');
    buf = Buffer.from(s.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  }
  return buf.toString(p.charset && /^utf-?8$/i.test(p.charset) ? 'utf8' : 'latin1');
}
