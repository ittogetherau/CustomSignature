import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compose, decode, parts, rewrite, SIG } from './helpers.js';

const CRLF = '\r\n';

describe('rewriteMessage', () => {
  it('signs multipart/alternative with an attachment and an inline image; binary parts are byte-identical', async () => {
    const pdf = randomBytes(300_000);
    const png = randomBytes(20_000);
    const raw = await compose({
      from: 'jane@contoso.com',
      to: 'bob@example.com',
      subject: 'Quarterly report',
      headers: { 'X-Mailer': 'Microsoft Outlook 16.0' },
      text: 'Hi Bob,\r\n\r\nReport attached.\r\n',
      html: '<html><body><p>Hi Bob,</p><p>Report attached.</p><img src="cid:logo@x"></body></html>',
      attachments: [
        { filename: 'report.pdf', content: pdf, contentType: 'application/pdf' },
        { filename: 'logo.png', content: png, contentType: 'image/png', cid: 'logo@x' },
      ],
    });

    const before = await parts(raw);
    const { out, result } = await rewrite(raw);
    const after = await parts(out);

    expect(result.signed).toBe(true);
    expect(result.client).toBe('outlook-desktop');
    expect(out.toString('latin1').startsWith(`X-Inkwell-Signed: 1${CRLF}`)).toBe(true);

    const binBefore = before.filter((p) => !p.contentType.startsWith('text/'));
    const binAfter = after.filter((p) => !p.contentType.startsWith('text/'));
    expect(binBefore).toHaveLength(2);
    expect(binAfter.map((p) => p.sha256)).toEqual(binBefore.map((p) => p.sha256));
    expect(Buffer.from(binAfter.find((p) => p.filename === 'report.pdf')!.raw.toString(), 'base64').equals(pdf)).toBe(true);

    const html = decode(after.find((p) => p.contentType === 'text/html')!);
    expect(html).toContain('data-inkwell-sig');
    expect(html.indexOf('data-inkwell-sig')).toBeLessThan(html.indexOf('</body>'));
    const text = decode(after.find((p) => p.contentType === 'text/plain')!);
    expect(text).toContain('Report attached.\r\n\r\nJane Doe · IT Together');
  });

  it('everything outside the two text parts is byte-identical', async () => {
    const raw = await compose({
      from: 'jane@contoso.com',
      to: 'bob@example.com',
      subject: 'x',
      text: 'plain',
      html: '<p>html</p>',
      attachments: [{ filename: 'a.bin', content: randomBytes(5000) }],
    });
    const { out } = await rewrite(raw);
    const s = out.toString('latin1');
    // headers of the root are untouched apart from the prepended line
    const rootHead = raw.toString('latin1').split(CRLF + CRLF)[0];
    expect(s.startsWith(`X-Inkwell-Signed: 1${CRLF}${rootHead}${CRLF}${CRLF}`)).toBe(true);
  });

  it('calendar invite: text/calendar part is untouched, HTML body is signed', async () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'METHOD:REQUEST',
      'PRODID:Microsoft Exchange Server 2010',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'ORGANIZER;CN=Jane Doe:mailto:jane@contoso.com',
      'ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:bob@example.com',
      'DESCRIPTION;LANGUAGE=en-AU:Let us catch up\\n',
      'UID:040000008200E00074C5B7101A82E00800000000',
      'SUMMARY;LANGUAGE=en-AU:Catch-up',
      'DTSTART:20261110T230000Z',
      'DTEND:20261110T233000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join(CRLF);
    const raw = await compose({
      from: 'jane@contoso.com',
      to: 'bob@example.com',
      subject: 'Catch-up',
      text: 'Let us catch up',
      html: '<html><body><div>Let us catch up</div></body></html>',
      icalEvent: { method: 'REQUEST', content: ics },
    });
    const before = await parts(raw);
    const { out, result } = await rewrite(raw);
    const after = await parts(out);
    expect(result.signed).toBe(true);
    const calBefore = before.filter((p) => p.contentType === 'text/calendar');
    const calAfter = after.filter((p) => p.contentType === 'text/calendar');
    expect(calAfter.length).toBeGreaterThan(0);
    expect(calAfter.map((p) => p.sha256)).toEqual(calBefore.map((p) => p.sha256));
    expect(out.toString('latin1')).toMatch(/text\/calendar; charset=utf-8; method=REQUEST/i);
    expect(decode(after.find((p) => p.contentType === 'text/html')!)).toContain('data-inkwell-sig');
  });

  it('S/MIME multipart/signed passes through untouched (header added)', async () => {
    const raw = [
      'From: jane@contoso.com',
      'To: bob@example.com',
      'Subject: signed',
      'MIME-Version: 1.0',
      'Content-Type: multipart/signed; protocol="application/pkcs7-signature"; micalg=sha-256; boundary="SIG"',
      '',
      '--SIG',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      '<html><body><p>Signed body</p></body></html>',
      '--SIG',
      'Content-Type: application/pkcs7-signature; name=smime.p7s',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename=smime.p7s',
      '',
      randomBytes(600).toString('base64'),
      '--SIG--',
      '',
    ].join(CRLF);
    const { out, result } = await rewrite(raw);
    expect(result.signed).toBe(false);
    expect(result.reason).toBe('secure');
    expect(out.toString('latin1')).toBe(`X-Inkwell-Signed: 1${CRLF}${raw}`);
  });

  it('S/MIME application/pkcs7-mime (encrypted) passes through untouched', async () => {
    const raw = [
      'From: jane@contoso.com',
      'To: bob@example.com',
      'Subject: secret',
      'MIME-Version: 1.0',
      'Content-Type: application/pkcs7-mime; smime-type=enveloped-data; name=smime.p7m',
      'Content-Transfer-Encoding: base64',
      'Content-Disposition: attachment; filename=smime.p7m',
      '',
      randomBytes(900).toString('base64').replace(/(.{76})/g, `$1${CRLF}`),
      '',
    ].join(CRLF);
    const { out, result } = await rewrite(raw);
    expect(result.reason).toBe('secure');
    expect(out.toString('latin1')).toBe(`X-Inkwell-Signed: 1${CRLF}${raw}`);
  });

  it('no duplicate signature on a reply whose quoted part already has one', async () => {
    const html =
      '<html><body><div>Sounds good.</div><div id="appendonsend"></div>' +
      '<hr style="display:inline-block;width:98%" tabindex="-1">' +
      '<div id="divRplyFwdMsg" dir="ltr"><b>From:</b> Jane Doe</div>' +
      '<div><p>Earlier message</p><div data-inkwell-sig="1"><b>Jane Doe</b></div></div></body></html>';
    const raw = await compose({ from: 'bob@contoso.com', to: 'jane@contoso.com', subject: 'RE: x', html });
    const { out, result } = await rewrite(raw);
    expect(result.signed).toBe(true);
    const outHtml = decode((await parts(out)).find((p) => p.contentType === 'text/html')!);
    expect(outHtml.match(/data-inkwell-sig/g)).toHaveLength(2);
    expect(outHtml.indexOf('data-inkwell-sig')).toBeLessThan(outHtml.indexOf('appendonsend'));

    // Running the result through again adds nothing.
    const second = await rewrite(out.subarray(out.indexOf(CRLF) + 2));
    const html2 = decode((await parts(second.out)).find((p) => p.contentType === 'text/html')!);
    expect(second.result.signed).toBe(false);
    expect(html2.match(/data-inkwell-sig/g)).toHaveLength(2);
  });

  it('message already carrying X-Inkwell-Signed is passed through byte-for-byte', async () => {
    const raw = `X-Inkwell-Signed: 1${CRLF}From: a@contoso.com${CRLF}Subject: x${CRLF}${CRLF}hello${CRLF}`;
    const { out, result } = await rewrite(raw);
    expect(result.reason).toBe('already-signed');
    expect(out.toString()).toBe(raw);
  });

  it('pass-through when no signature applies: only the header is added', async () => {
    const raw = await compose({ from: 'a@contoso.com', to: 'b@x.com', subject: 's', text: 't', html: '<p>h</p>' });
    const { out, result } = await rewrite(raw, null);
    expect(result.reason).toBe('no-signature');
    expect(out.equals(Buffer.concat([Buffer.from(`X-Inkwell-Signed: 1${CRLF}`), raw]))).toBe(true);
  });

  it('plain-text only message in ISO-8859-1 quoted-printable is converted to UTF-8', async () => {
    const raw = [
      'From: jane@contoso.com',
      'To: bob@example.com',
      'Subject: caf',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=iso-8859-1; format=flowed',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Meet at the caf=E9?',
      '',
      '-----Original Message-----',
      'From: Bob',
      'old',
      '',
    ].join(CRLF);
    const { out, result } = await rewrite(raw);
    expect(result.signed).toBe(true);
    const [p] = await parts(out);
    expect(p.charset).toBe('utf-8');
    expect(decode(p).replace(/\r\n/g, "\n")).toBe(
      "Meet at the café?\n\nJane Doe · IT Together\n\n-----Original Message-----\nFrom: Bob\nold\n",
    );
  });

  it('HTML in windows-1252 base64 gets its meta charset updated', async () => {
    const htmlSrc = Buffer.from(
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=windows-1252"></head><body><p>Gr\xFC\xDFe</p></body></html>',
      'latin1',
    );
    const raw = [
      'From: jane@contoso.com',
      'Subject: x',
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="windows-1252"',
      'Content-Transfer-Encoding: base64',
      '',
      htmlSrc.toString('base64'),
      '',
    ].join(CRLF);
    const { out } = await rewrite(raw);
    const [p] = await parts(out);
    const html = Buffer.from(p.raw.toString(), 'base64').toString('utf8');
    expect(html).toContain('Grüße');
    expect(html).toContain('charset=utf-8');
    expect(html).toContain('data-inkwell-sig');
  });

  it('does not touch text inside an attached message/rfc822', async () => {
    const inner = 'From: x@y.com\r\nSubject: inner\r\nContent-Type: text/html\r\n\r\n<p>inner</p>\r\n';
    const raw = await compose({
      from: 'jane@contoso.com',
      to: 'bob@example.com',
      subject: 'FW',
      html: '<p>see attached</p>',
      attachments: [{ filename: 'inner.eml', content: inner, contentType: 'message/rfc822' }],
    });
    const before = await parts(raw);
    const { out } = await rewrite(raw);
    const after = await parts(out);
    const rfc = (l: typeof before) => l.find((p) => p.contentType === 'message/rfc822')!;
    expect(rfc(after).sha256).toBe(rfc(before).sha256);
    expect(out.toString().match(/data-inkwell-sig/g)).toHaveLength(1);
  });
});
