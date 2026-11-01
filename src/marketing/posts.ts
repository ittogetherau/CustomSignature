export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  readMins: number
  tag: string
  cover: { from: string; to: string; effect: 'orbit' | 'halo' | 'shine' | 'sparkle' | 'breathe' | 'hello' | 'draw' }
  /** Lightweight markdown: "## " heading, "### " subheading, "- " bullet, "1. " numbered, "> " callout; blank line = paragraph break. */
  body: string
}

export const POSTS: Post[] = [
  {
    slug: 'email-signature-best-practices',
    title: 'Email signature best practices: the 2026 checklist',
    excerpt: 'What to include, what to cut, and the small design decisions that make a signature look professional in every inbox.',
    date: '2026-10-28',
    readMins: 6,
    tag: 'Guides',
    cover: { from: '#0f766e', to: '#34d399', effect: 'orbit' },
    body: `Your team sends thousands of emails a week, and every one ends with a signature. It is the most-viewed piece of brand real estate most companies own — and usually the least managed. Here is a practical checklist for getting it right.

## Keep the essentials, drop the rest

A signature has one job: tell the reader who you are and how to reach you, quickly. Include:

- Full name and job title
- Company name (or logo)
- One phone number and your email address
- Website — ideally a page that is relevant to the reader, not just the homepage

Most people do not need a fax number, three phone numbers, a home address and every social network. Each extra line dilutes the ones that matter.

## Design for the smallest screen first

More than half of business email is read on a phone. Keep the total width around 500–600 pixels, use a body font size of 12–14px, and make sure tap targets such as phone numbers and buttons are comfortably large. A two-column layout that collapses gracefully beats a three-column layout that turns into a jumble.

## Use web-safe fonts and hosted images

Custom fonts are rarely rendered by mail apps, so a signature designed in a brand typeface will fall back to something unpredictable. Stick to Helvetica, Arial, Segoe UI, Georgia and similar. Images should be hosted on a reliable server and referenced by URL rather than embedded — Gmail and many corporate gateways block embedded images entirely.

## One call to action, not five

A single, specific link — "Book a meeting", "Read our latest case study", "Register for the webinar" — will outperform a row of competing buttons. Rotate it as your priorities change rather than adding more.

## Make it consistent across the whole company

The strongest signal of a professional organisation is consistency: the same logo, colours, layout and legal text for everyone. That is hard to achieve when each person maintains their own signature. Centrally managed signatures, generated from a single brand kit and your company directory, remove the drift entirely.

> **Quick test:** forward an email from five random colleagues to yourself. If the signatures do not look like they belong to the same company, it is time to centralise.

## Accessibility matters

Add alt text to your logo and photo so screen readers announce something meaningful. Keep enough colour contrast between text and background, and never put essential information — like your phone number — only inside an image.

## Review it twice a year

Job titles change, phone numbers move, campaigns end. Put a recurring reminder in the calendar, or connect your signatures to Microsoft 365 so updates in the directory flow through automatically.`,
  },
  {
    slug: 'microsoft-365-company-wide-signatures',
    title: 'How to roll out company-wide signatures in Microsoft 365',
    excerpt: 'The options Microsoft gives you, where they fall short, and how to keep every employee on brand without chasing anyone.',
    date: '2026-10-21',
    readMins: 7,
    tag: 'Microsoft 365',
    cover: { from: '#2563eb', to: '#06b6d4', effect: 'halo' },
    body: `If your company runs on Microsoft 365, you have a few ways to give everyone a consistent email signature. Each has trade-offs. Here is how they compare, and the approach we recommend for most organisations.

## Option 1: Ask everyone to set it up themselves

The most common approach is also the least reliable. You send a template, everyone pastes it into Outlook, and within a month half the company has edited, resized or broken it. New starters copy a colleague's out-of-date version. There is no way to update everyone at once.

## Option 2: Exchange transport rules (disclaimers)

Exchange Online can append HTML to outgoing messages with a mail flow rule. It guarantees a footer is present, but the editing experience is basic, personalisation is limited to a handful of directory fields, and the signature is added after sending — so the sender never sees it, and it lands at the very bottom of long reply chains.

## Option 3: A signature manager connected to your directory

A dedicated signature manager uses Microsoft Entra ID (formerly Azure AD) as the source of truth. Names, job titles, departments, phone numbers and profile photos come straight from the directory, and every signature is generated from one company template.

### What the setup looks like in Inkwell

1. **Sign in with Microsoft.** Your workspace is created and linked to your Microsoft 365 tenant.
2. **Approve directory access once.** A Microsoft 365 administrator clicks "Approve for my organisation" on Microsoft's own consent screen. Inkwell requests read-only access to the user directory — it never sends mail or changes anything in your tenant.
3. **Your directory imports automatically.** Licensed mailboxes are imported; guests, disabled accounts and shared or room mailboxes are skipped.
4. **Stay in sync every day.** New starters are added, role changes update and leavers are flagged — nightly, with nobody logged in.

> If the person setting things up is not an admin, Inkwell gives them a link to send to IT. Once IT approves, the sync just works.

## Keep the directory clean

Directory-driven signatures are only as good as the directory. Before you roll out, check that job titles are consistent ("Sales Manager" vs "Mgr, Sales"), departments are filled in and phone numbers use one format. Fixing it once improves Teams, Outlook and every other tool that reads the directory too.

## Roll out in stages

Start with one department, collect feedback for a week, then expand. Pair the launch with a short note explaining why — consistency, compliance, and a professional look for every customer interaction.`,
  },
  {
    slug: 'animated-email-signatures-gmail-outlook',
    title: 'Animated email signatures: what works in Gmail and Outlook',
    excerpt: 'CSS animation is stripped by most inboxes. Animated GIFs are not. Here is how to add motion that actually plays — and degrades gracefully.',
    date: '2026-10-14',
    readMins: 5,
    tag: 'Design',
    cover: { from: '#e2643b', to: '#f3a55b', effect: 'sparkle' },
    body: `A little motion in a signature — a glowing profile ring, a shimmering button — catches the eye and makes a brand feel modern. But most "animated signature" tutorials stop working the moment the email leaves your outbox. Here is why, and what to do instead.

## Why CSS animation disappears

Web pages animate with CSS. Email clients, however, sanitise messages heavily for security. Gmail removes most <style> blocks, Outlook for Windows renders email with Microsoft Word's engine, and many corporate gateways strip anything unusual. CSS keyframes simply never reach the reader.

## Why GIFs work

Animated GIFs are images, and images are universally supported. Gmail, Outlook on the web, Outlook for Mac, Apple Mail and the major mobile apps all play them. That is why Inkwell renders motion — orbiting rings, halo pulses, light sweeps, sparkles, a waving "Hi!" — frame by frame and encodes it as a lightweight GIF hosted for you.

## The Outlook for Windows exception

Classic Outlook for Windows desktop shows only the first frame of a GIF. The solution is to design every animation so that frame one is a finished, polished image. In Inkwell, every effect starts complete — a full ring, a visible greeting — and animates from there, so desktop Outlook users see a clean static signature rather than a half-drawn one.

## Keep it light

- Aim for under 400 KB per animated image. Inkwell uses a shared colour palette across frames to keep files small.
- Loop subtly. Motion should draw the eye once, not compete with the email.
- Animate one or two elements — usually the photo and the call-to-action — rather than everything.

## Accessibility and dark mode

Avoid fast flashing (more than three flashes per second). Give images meaningful alt text. And because many dark-mode clients keep images on a light surface, design animations on a white background so they look intentional either way.

> **The result:** motion that plays for the vast majority of readers and looks deliberate for everyone else.`,
  },
  {
    slug: 'email-disclaimers-australian-businesses',
    title: 'Email disclaimers: a practical guide for Australian businesses',
    excerpt: 'Confidentiality notices, privacy statements and regulated-industry wording — what is common, what is useful and how to manage it centrally.',
    date: '2026-10-07',
    readMins: 6,
    tag: 'Compliance',
    cover: { from: '#1e293b', to: '#475569', effect: 'shine' },
    body: `Many organisations add a disclaimer to every outgoing email. Some are required by regulation, others are best practice, and a few are mostly habit. This guide covers the common types and how to manage them consistently. It is general information, not legal advice — check the specific requirements for your industry with your adviser.

## Common types of disclaimer

### Confidentiality notices

The familiar "This email is confidential and intended only for the named recipient…" notice. Its legal effect is debated, but it sets expectations and is standard in professional services.

### Privacy statements

Organisations covered by the Privacy Act 1988 handle personal information under the Australian Privacy Principles. A short statement linking to your privacy policy helps recipients understand how information they send will be handled.

### Regulated-industry wording

Financial services, legal practices, health providers and others often have sector-specific wording — for example, licence numbers, "general advice" warnings or professional standards scheme notices. These are the disclaimers where precision matters most.

### Environmental and marketing notes

"Please consider the environment before printing" has largely faded, while unsubscribe information remains important for commercial electronic messages under the Spam Act 2003.

## Keep it short and readable

A disclaimer that runs longer than the email itself trains people to ignore it. Use small, legible text below the signature, and keep each notice to two or three sentences where possible.

## Manage it centrally

The real risk with disclaimers is inconsistency: an outdated licence number, a missing notice on one team's signatures, or a disclaimer pasted three times in a reply chain. In Inkwell, legal text lives in the brand kit and is appended to every team signature automatically. Update it once and everyone's signature changes — no reminders, no stragglers.

> **Tip:** Keep a dated record of disclaimer changes. If you are ever asked what wording was in use on a given day, you will have the answer.`,
  },
  {
    slug: 'signature-banners-marketing-channel',
    title: 'Turn every email into a marketing channel with signature banners',
    excerpt: 'Your team already sends the emails. A well-timed banner turns that volume into webinar sign-ups, case-study reads and booked meetings.',
    date: '2026-09-30',
    readMins: 5,
    tag: 'Marketing',
    cover: { from: '#7c3aed', to: '#ec4899', effect: 'hello' },
    body: `A 50-person company sends tens of thousands of emails a month. Every one is opened by someone who already has a relationship with you — a customer, a supplier, a prospect mid-conversation. A signature banner puts a timely message in front of all of them, at no extra cost.

## What makes a good signature banner

- **One message.** "Join our webinar on 20 November" beats a list of everything you offer.
- **A clear action.** A short button label — "Save my seat", "Read the story" — tells people exactly what to do.
- **Brand colours, readable type.** Banners are small. High contrast and a big headline matter more than detail.
- **A real destination.** Link to a page made for the campaign, not your homepage.

## Ideas that work well

1. Upcoming events and webinars
2. A new case study or customer story
3. Product launches and feature announcements
4. Holiday hours and service updates
5. Recruiting — "We're hiring" banners reach your network's network

## Target by team

Sales emails and support emails reach different people. Inkwell lets you schedule a banner with a start and end date and target it to specific departments — a webinar banner for Sales and Marketing, a service update for Support — while everyone else keeps their standard signature.

## Schedule, don't remember

The most common banner mistake is leaving an old campaign running long after the event. Set an end date when you create the banner and it disappears automatically.

> **Measure what matters:** use a campaign-specific link (for example with UTM parameters) so you can see banner traffic in your web analytics.`,
  },
]

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug)
export const fmtDate = (d: string) => new Date(d + 'T00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
