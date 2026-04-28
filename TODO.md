# Fix `api/auth/login` 404 Error

## Plan
- [x] Add `rootDir: backend` to `render.yaml`
- [x] Add deployment/local-dev notes to `README.md` (or `TODO.md`)
- [ ] Verify backend service restarts with correct root directory
- [ ] Confirm `/api/auth/login` no longer returns 404

## Notes
- **Root cause**: `render.yaml` did not specify `rootDir`, so Render ran commands from the repo root and could not find `main.py` inside the `backend/` folder. This caused the backend service to fail/mis-route, resulting in 404 on all `/api/*` paths.
- **Fix applied**: Added `rootDir: backend` to `render.yaml` so Render treats the `backend/` directory as the service root, correctly resolving `requirements.txt` and `main.py`.
- **Next step**: Push the fix and trigger a new deploy on Render. After the deploy succeeds, test `POST /api/auth/login` from the Vercel frontend again.

