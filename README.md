Wallpaper Sharing community website with best design and animations
Using liquid glass inspired by ios.
New Features in progress.

## Media storage (Cloudinary + free hosts)

Uploads are stored via a pluggable backend in `server/lib/`:

- **Cloudinary** (recommended, free 25GB) — set `CLOUDINARY_*` in `server/.env`
- Google Drive (legacy), ImageKit, ImgBB, Catbox (no-key fallback)

See [MEDIA_SETUP.md](./MEDIA_SETUP.md) + `server/.env.example` and `client/.env.example`.

Run locally:

```bash
cd server && npm install && node server.js   # :4000, GET /api/config
cd client && npm install && npm run dev      # set VITE_API_BASE_URL to :4000
```
