# Backend Integration Progress

## ✅ Completed

### API Service Files Created
- **client.ts** - HTTP client wrapper for all API calls
- **authApi.ts** - Authentication endpoints (login, signup, getCurrentUser)
- **scrutinyApi.ts** - Scrutiny analysis endpoints (analyze, previewSchema, exportReport)
- **workbooksApi.ts** - Workbook management endpoints (list, create, get, saveEntityConfig, ingestFile)
- **clientApi.ts** - Client management endpoints (list, create, get, update, delete)

### Backend Endpoints Available
- POST `/api/scrutiny/analyze` - Run analysis on uploaded file
- POST `/api/scrutiny/schema-preview` - Preview schema mapping
- POST `/api/scrutiny/export` - Export report as Excel
- POST `/api/auth/signup` - Register new user
- POST `/api/auth/login` - Authenticate user
- GET `/api/auth/me` - Get current user info
- GET `/api/workbooks` - List all workbooks
- POST `/api/workbooks` - Create workbook
- GET `/api/workbooks/{id}` - Get workbook details
- PUT `/api/workbooks/{id}/entity-config` - Save entity configuration
- POST `/api/workbooks/{id}/ingest` - Ingest file and run analysis
- GET `/api/clients` - List all clients
- POST `/api/clients` - Create client
- GET `/api/clients/{id}` - Get client details
- PUT `/api/clients/{id}` - Update client
- DELETE `/api/clients/{id}` - Delete client

## 🔧 Next Steps - Components to Update

### 1. **Documentation.tsx** - Export Functionality
- [ ] Replace mock `handleExportPDF()` with real backend export
- [ ] Call `scrutinyApi.exportReport()` when user clicks Export button
- [ ] Add progress toast while exporting
- [ ] Handle download response as blob

### 2. **Home.tsx** - Workbooks List
- [ ] Replace mock workbooks with `workbooksApi.listWorkbooks()`
- [ ] Add "Create Workbook" button that calls `workbooksApi.createWorkbook()`
- [ ] Show loading state while fetching
- [ ] Handle errors with toast notifications

### 3. **DataIngestionWorkspace.tsx** - File Upload
- [ ] Replace file upload with `workbooksApi.ingestFile()`
- [ ] Show progress during analysis
- [ ] Display real results from backend
- [ ] Handle schema preview with `scrutinyApi.previewSchema()`

### 4. **Dashboard.tsx** - Real Data
- [ ] Load actual flagged transactions from analysis results
- [ ] Display real risk scores
- [ ] Connect search/filter functionality to backend data

### 5. **Login.tsx & Onboarding.tsx** - Authentication
- [ ] Call `authApi.login()` on form submit
- [ ] Call `authApi.signup()` for new users
- [ ] Store token with `authApi.setToken()`
- [ ] Redirect to home on success

### 6. **RiskIntelligenceDashboard.tsx** - Analytics
- [ ] Fetch workbook data
- [ ] Display real statistics from backend

## 📋 Important Notes

- **API Base URL**: `http://localhost:8000/api`
- **Authentication**: Uses JWT token stored in `localStorage.auth_token`
- **Bearer token needed** for most endpoints (except auth endpoints)
- **CORS**: Backend configured with wildcard origin
- **File uploads**: Use FormData for multipart requests

## 🚀 To Start Backend

```bash
cd backend
python -m uvicorn main:app --reload
```

Server will run on `http://localhost:8000`
