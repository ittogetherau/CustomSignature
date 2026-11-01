# Inkwell — Email Signature Studio

A standalone email-signature manager: design signatures from 16 templates, roll them out to a team from one brand kit, and attach campaign banners. No Google/Microsoft integration — signatures are installed by copy-paste or HTML download.

```bash
npm install
npm run dev     # http://localhost:5180
```

## What's in it

| Area | |
| --- | --- |
| **Editor** (`src/pages/Editor.tsx`) | Live preview in a mock inbox (desktop / mobile / dark), autosave, copy as rich text, copy HTML, download `.html`, install guides for Gmail, Outlook, Apple Mail and iPhone |
| **Templates** (`src/lib/templates.ts`, `src/lib/render.ts`) | 16 designs, 6 animated. Built from nested tables with inline styles so they survive mail clients; animations (glowing photo ring, floating logo, verified-badge pop, hover-lift icons, banner shimmer) are progressive enhancement |
| **Team manager** | CSV bulk import, per-person or bulk template assignment, preview/copy/export every signature |
| **Banners & campaigns** | Gradient / dark / light / image banners, scheduling, department targeting |
| **Brand kit** | Logo (with "match colours to logo"), palette, font, socials, legal disclaimer — feeds every team signature |
| **Analytics** | Impressions, clicks, CTR, top links, department and client breakdowns |

## Notes

- Data lives in `localStorage` (`inkwell.v2`). Brand kit → "Reset workspace" restores the demo set.
- Analytics are **simulated** — real tracking needs hosted images and redirect links on a server.
- Uploaded images are embedded as data URLs; Gmail blocks those when sending, so use hosted image URLs for real use.
- Social/contact icons are PNGs from `img.icons8.com`, which is how deployed signatures need them (mail clients don't render SVG).
