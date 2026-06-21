# Gerald & Donella Wedding Site

Monorepo for the wedding website.

```
.
├── web/      # Vite + React + TypeScript UI
├── api/      # Cloudflare Workers — RSVP & Registry endpoints
├── db/       # SQL schema and migrations (D1)
└── shared/   # Shared TypeScript types
```

## Wedding details

- **Date**: Saturday, October 3rd, 2026
- **Location**: Lilongwe, Malawi

## Palette

| Token        | Hex       |
| ------------ | --------- |
| Beige        | `#DBC4A0` |
| Champagne    | `#F7E7CE` |
| Sage Green   | `#A3B18A` |
| Brown        | `#7C6752` |

## Quickstart

```bash
cd web && npm install && npm run dev
```

The old root `node_modules/` from the initial scaffold can be deleted; the active install lives in `web/node_modules/`.
