# Fix Vercel Build Error

## Problem
Vercel build fails with:
```
npm error Missing script: "vercel-build"
Error: Command "npm run vercel-build" exited with 1
```

## Root Cause
- `vercel.json` configures `"buildCommand": "npm run vercel-build"`
- Root `package.json` has the `vercel-build` script
- Vercel auto-detects the frontend framework (Vite) and runs npm from the `frontend/` directory
- `frontend/package.json` was missing the `vercel-build` script

## Plan
- [x] Add `"vercel-build": "npm run build"` to `frontend/package.json` scripts

## Files edited
- `frontend/package.json`

## Status
Fixed. Vercel will now find and execute `vercel-build` from `frontend/package.json`, which delegates to the existing `build` script (`tsc -b && vite build`).

