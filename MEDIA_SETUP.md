# PixelWalls V2 — free media storage setup

PixelWalls now supports **pluggable wallpaper storage**. Uploads go to one
configured provider, listings merge across all configured providers.

## Providers (all have free tiers)

| Provider | Free tier | Needs key? | Best for |
|---|---|---|---|
| **Cloudinary** (recommended) | ~25 GB storage + 25 GB bandwidth, transforms (`f_auto,q_auto,w_2048`) | Yes: `CLOUDINARY_CLOUD_NAME/KEY/SECRET` | Production primary, persistent listing via Search API |
| Google Drive (legacy) | 15 GB Drive | Yes: OAuth JSON | Existing deployments, kept working |
| ImageKit.io | 20 GB bandwidth | Yes: private key + URL endpoint | Transforms + CDN |
| ImgBB | 32 MB/file | Yes: `IMGBB_API_KEY` (https://api.imgbb.com) | Simple fallback |
| Catbox.moe | 200 MB/file, permanent | **No** — on by default | Zero-setup fallback / local dev |

Select with `STORAGE_PROVIDER` (`auto` default = first configured in
`cloudinary,googledrive,imagekit,imgbb,catbox`), e.g.:

```bash
STORAGE_PROVIDER=cloudinary,imgbb
STORAGE_PROVIDER=cloudinary   # force Cloudinary only
```

## Quick start — Cloudinary (recommended)

1. Create free account at https://cloudinary.com → Console → copy **Cloud name, API Key, API Secret**.
2. `cp server/.env.example server/.env` and fill:
   ```bash
   STORAGE_PROVIDER=cloudinary
   CLOUDINARY_CLOUD_NAME=xxxx
   CLOUDINARY_API_KEY=xxxx
   CLOUDINARY_API_SECRET=xxxx
   CLOUDINARY_FOLDER=pixelwalls
   ```
3. `cd server; npm install; npm start` (or deploy `server/` to Vercel with those env vars).
4. `cp client/.env.example client/.env` → set `VITE_API_BASE_URL=http://localhost:4000` (or your Vercel URL).
5. `cd client; npm install; npm run dev`.

Uploads store `alt/author/category` in Cloudinary **context** + tags, and
`GET /api/wallpapers` reads them back via the Search API — no extra DB needed.

## Zero-key dev (Catbox)

With no keys set, the API auto-uses Catbox (`primary: "catbox"`).
Metadata is kept in `server/data/wallpapers.json` (git-ignored). Note: on
Vercel the filesystem is ephemeral, so use Cloudinary/Drive in production.

## URL import (other free media)

`POST /api/upload` accepts either multipart `image` **or** JSON
`{ imageUrl, alt, author, category }`. The backend fetches the URL and
re-hosts it on your primary provider. The Upload modal has an
**Import from URL** tab — paste Unsplash / Pexels / picsum.photos links.

## API

- `GET /api/config` → `{ providers, primary, maxUploadMB, features }`
- `GET /api/health`
- `GET /api/wallpapers` → merged `[{ id, url, fullUrl?, alt, author, category, width, height, provider }]`
- `POST /api/upload` → multipart or `{ imageUrl }`, returns wallpaper entry
