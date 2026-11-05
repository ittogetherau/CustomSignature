import { describe, expect, it } from 'vitest';
import { elementEnd, insertHtml, insertSignature, insertText } from '../src/insert.js';

const SIG = { html: '<p class="sig">Jane Doe | IT Together</p>', text: 'Jane Doe | IT Together' };
const WRAPPED = `<div data-inkwell-sig="1">${SIG.html}</div>`;

/** position of the signature relative to a marker string */
function sigBefore(out: string, marker: string): boolean {
  const s = out.indexOf('data-inkwell-sig');
  const m = out.indexOf(marker);
  return s !== -1 && m !== -1 && s < m;
}

describe('insertHtml – client fixtures', () => {
  it('Outlook desktop: before <div id="appendonsend">', () => {
    const html =
      '<html><body><div class="WordSection1"><p>Thanks!</p></div>' +
      '<div id="appendonsend"></div><hr style="display:inline-block;width:98%" tabindex="-1">' +
      '<div id="divRplyFwdMsg" dir="ltr"><b>From:</b> Bob</div><div>old text</div></body></html>';
    const out = insertHtml(html, SIG.html)!;
    expect(out).toContain(`<p>Thanks!</p></div>${WRAPPED}<div id="appendonsend">`);
    expect(out.match(/data-inkwell-sig/g)).toHaveLength(1);
  });

  it('Outlook web: before divRplyFwdMsg when there is no appendonsend', () => {
    const html = '<div>Reply text</div><div id="divRplyFwdMsg" dir="ltr"><font><b>From:</b> Bob</font></div><div>quoted</div>';
    const out = insertHtml(html, SIG.html)!;
    expect(out).toBe(`<div>Reply text</div>${WRAPPED}<div id="divRplyFwdMsg" dir="ltr"><font><b>From:</b> Bob</font></div><div>quoted</div>`);
  });

  it('Outlook web: before the 98% <hr> separator', () => {
    const html = '<div>Reply</div><hr style="display:inline-block;width:98%" tabindex="-1"><div>quoted</div>';
    expect(sigBefore(insertHtml(html, SIG.html)!, '<hr')).toBe(true);
  });

  it('Outlook mobile: replaces the ms-outlook-mobile-signature element', () => {
    const html =
      '<html><body><div dir="auto">Sent from my phone reply</div><div><br></div>' +
      '<div id="ms-outlook-mobile-signature"><div><br></div>Get <a href="https://aka.ms/o0ukef">Outlook for iOS</a></div>' +
      '<div id="appendonsend"></div><hr style="display:inline-block;width:98%"><div id="divRplyFwdMsg">From: X</div></body></html>';
    const out = insertHtml(html, SIG.html)!;
    expect(out).not.toContain('Outlook for iOS');
    expect(out).not.toContain('ms-outlook-mobile-signature');
    expect(out).toContain(`<div><br></div>${WRAPPED}<div id="appendonsend">`);
  });

  it('Outlook mobile signature in the quoted part is left alone', () => {
    const html =
      '<div>New</div><div id="divRplyFwdMsg">From: X</div>' +
      '<div id="ms-outlook-mobile-signature">Get <a>Outlook for Android</a></div>';
    const out = insertHtml(html, SIG.html)!;
    expect(out).toContain('Outlook for Android');
    expect(sigBefore(out, 'divRplyFwdMsg')).toBe(true);
  });

  it('iOS Mail: before <blockquote type="cite">', () => {
    const html =
      '<html><head></head><body dir="auto">Sounds good<br><br><div dir="ltr">Sent from my iPhone</div>' +
      '<div dir="ltr"><br><blockquote type="cite">On 4 Nov 2026, at 10:00, Bob wrote:<br></blockquote></div>' +
      '<blockquote type="cite"><div dir="ltr">old</div></blockquote></body></html>';
    const out = insertHtml(html, SIG.html)!;
    expect(out.indexOf('data-inkwell-sig')).toBeLessThan(out.indexOf('<blockquote'));
    expect(out.indexOf('data-inkwell-sig')).toBeGreaterThan(out.indexOf('Sounds good'));
  });

  it('Gmail: before the gmail_quote block', () => {
    const html =
      '<div dir="ltr">Sure thing</div><br><div class="gmail_quote gmail_quote_container">' +
      '<div dir="ltr" class="gmail_attr">On Tue, Bob wrote:<br></div><blockquote class="gmail_quote">old</blockquote></div>';
    const out = insertHtml(html, SIG.html)!;
    expect(out).toContain(`<br>${WRAPPED}<div class="gmail_quote gmail_quote_container">`);
  });

  it('new message: before </body>', () => {
    const out = insertHtml('<html><body><p>Hello</p></body></html>', SIG.html)!;
    expect(out).toBe(`<html><body><p>Hello</p>${WRAPPED}</body></html>`);
  });

  it('fragment without body: appended at the end', () => {
    expect(insertHtml('<p>Hello</p>', SIG.html)).toBe(`<p>Hello</p>${WRAPPED}`);
  });

  it('earliest marker wins', () => {
    const html = '<p>a</p><div class="gmail_quote">x</div><div id="appendonsend"></div>';
    expect(insertHtml(html, SIG.html)).toBe(`<p>a</p>${WRAPPED}<div class="gmail_quote">x</div><div id="appendonsend"></div>`);
  });
});

describe('duplicate protection', () => {
  it('skips when the new part already has a signature', () => {
    const html = `<p>Hi</p>${WRAPPED}<div id="appendonsend"></div>`;
    expect(insertHtml(html, SIG.html)).toBeNull();
  });

  it('a signature only in the quoted part does not stop insertion, and is not duplicated above', () => {
    const html =
      '<p>Reply</p><div id="appendonsend"></div><div id="divRplyFwdMsg">From: me</div>' +
      `<div><p>Original</p>${WRAPPED}</div>`;
    const out = insertHtml(html, SIG.html)!;
    expect(out.match(/data-inkwell-sig/g)).toHaveLength(2);
    expect(out.startsWith(`<p>Reply</p>${WRAPPED}<div id="appendonsend">`)).toBe(true);
    // inserting again (e.g. the message loops back) changes nothing
    expect(insertHtml(out, SIG.html)).toBeNull();
  });

  it('plain text: skips when the signature text is already above the quote', () => {
    const text = 'Hi\r\n\r\nJane Doe | IT Together\r\n\r\nFrom: Bob\r\nold';
    expect(insertText(text, SIG.text)).toBeNull();
  });
});

describe('insertText', () => {
  it('new message: appended with a blank line', () => {
    expect(insertText('Hello there\r\n', SIG.text)).toBe('Hello there\r\n\r\nJane Doe | IT Together\r\n');
  });

  it('reply: before "From:" and keeps the Outlook underscore separator with the quote', () => {
    const text = 'Thanks\r\n\r\n________________________________\r\nFrom: Bob <bob@x.com>\r\nSent: Monday\r\n\r\nold';
    expect(insertText(text, SIG.text)).toBe(
      'Thanks\r\n\r\nJane Doe | IT Together\r\n\r\n________________________________\r\nFrom: Bob <bob@x.com>\r\nSent: Monday\r\n\r\nold',
    );
  });

  it('reply: before -----Original Message-----', () => {
    const text = 'Ok\n-----Original Message-----\nFrom: Bob\nold';
    expect(insertText(text, SIG.text)).toBe('Ok\n\nJane Doe | IT Together\n\n-----Original Message-----\nFrom: Bob\nold');
  });

  it('a signature in the quoted text does not stop insertion', () => {
    const text = 'New\n\nFrom: Bob\nold\nJane Doe | IT Together\n';
    expect(insertText(text, SIG.text)).toBe('New\n\nJane Doe | IT Together\n\nFrom: Bob\nold\nJane Doe | IT Together\n');
  });

  it('removes "Get Outlook for iOS" from the new part', () => {
    const text = 'On my way\r\n\r\nGet Outlook for iOS<https://aka.ms/o0ukef>\r\n________________________________\r\nFrom: Bob\r\nold';
    const out = insertText(text, SIG.text)!;
    expect(out).not.toContain('Get Outlook');
    expect(out.startsWith('On my way\r\n\r\nJane Doe | IT Together\r\n\r\n_____')).toBe(true);
  });
});

describe('insertSignature', () => {
  it('handles both bodies and reports changes', () => {
    const r = insertSignature({ html: '<p>x</p>', text: 'x' }, SIG);
    expect(r.changed).toBe(true);
    expect(r.html).toContain('data-inkwell-sig');
    expect(r.text).toContain('Jane Doe');
  });

  it('reports no change for an already-signed message', () => {
    const r = insertSignature({ html: `<p>x</p>${WRAPPED}` }, SIG);
    expect(r.changed).toBe(false);
  });
});

describe('elementEnd', () => {
  it('matches nested same-name tags', () => {
    const html = '<div id="a"><div>x</div><div>y</div></div><p>after</p>';
    expect(html.slice(0, elementEnd(html, 0))).toBe('<div id="a"><div>x</div><div>y</div></div>');
  });
});
