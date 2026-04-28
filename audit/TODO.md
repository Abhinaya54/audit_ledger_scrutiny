# Fix Connection & Favicon Issues

## Plan
- [x] Step 1: Update `frontend/src/api/client.ts` — use relative `/api` base URL + add headers support
- [x] Step 2: Update `frontend/src/api/authApi.ts` — refactor `getCurrentUser()` to use `apiClient.get()`
- [x] Step 3: Update `frontend/index.html` — add favicon link to stop 404
- [x] Step 4: Update `frontend/src/api/workbooksApi.ts` — refactor to use `apiClient`
- [x] Step 5: Update `frontend/src/api/clientApi.ts` — refactor to use `apiClient`
- [x] Step 6: Verify no hardcoded `localhost:8000` remains in frontend

## Context
- `apiClient.ts` hardcodes `http://localhost:8000/api`, bypassing Vite proxy → causes `ERR_CONNECTION_REFUSED`
- Vite proxy only intercepts relative URLs like `/api/...`
- `index.html` has no favicon link → browser auto-requests `/favicon.ico` → 404