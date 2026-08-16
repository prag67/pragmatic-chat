# Keep existing LibreChat project, new repo for v2

Legacy (keep as-is): https://github.com/pragmaticonline/pragmatic-ai  -> /opt/librechat  (origin + fork remotes)
New (this folder /opt/pragmatic): create as https://github.com/pragmaticonline/pragmatic  OR  pragmatic-v2

```bash
# Create new empty GitHub repo `pragmaticonline/pragmatic` (do NOT init with README)
cd /opt/pragmatic
git checkout -b main
git add .
git commit -m "feat: scaffold Pragmatic v2 — Hono + Postgres + Vite (side-by-side with LibreChat)"
git remote add origin https://github.com/pragmaticonline/pragmatic.git
git push -u origin main
```

No history is shared with LibreChat — this is intentional so the new project is not recognizable as a fork.
Add both to your machine for cutover:

- /opt/librechat  -> legacy :3080
- /opt/pragmatic  -> new :5173/:4000
