from pathlib import Path

frontend = Path('frontend/src/api/workbooksApi.ts')
text = frontend.read_text()
if '<<<<<<< Updated upstream' not in text or '>>>>>>> Stashed changes' not in text:
    raise SystemExit('No frontend conflict markers found')
start = text.index('<<<<<<< Updated upstream')
end = text.index('>>>>>>> Stashed changes', start) + len('>>>>>>> Stashed changes')
resolved = '''  // Delete a workbook (soft delete)
  deleteWorkbook: async (workbookId: string): Promise<void> => {
    return apiClient.delete(`/api/workbooks/${workbookId}`, _token());
  },

  // Get all flagged transactions for a workbook
  getTransactions: async (workbookId: string): Promise<{ transactions: Record<string, any>[]; count: number }> => {
    return apiClient.get(`/api/workbooks/${workbookId}/transactions`, _token());
  },

  // Query and filter transactions
  queryTransactions: async (
    workbookId: string,
    filters: Record<string, any>
  ): Promise<{ transactions: Record<string, any>[]; count: number; filters_applied: Record<string, any> }> => {
    return apiClient.post(`/api/workbooks/${workbookId}/query`, filters, _token());
  },
'''
frontend.write_text(text[:start] + resolved + text[end:])

backend = Path('backend/routers/workbooks.py')
text = backend.read_text()
needle = '@router.delete("/{workbook_id}", status_code=status.HTTP_204_NO_CONTENT)\ndef delete_workbook(workbook_id: str, user_id: str = Depends(_current_user_id)):\n    try:\n        delete_workbook_for_user(user_id, workbook_id)\n\n\n@router.get("/{workbook_id}/transactions")\ndef get_transactions(\n'
if needle not in text:
    raise SystemExit('No backend delete route needle found')
replacement = '''@router.delete("/{workbook_id}", status_code=status.HTTP_204_NO_CONTENT)\ndef delete_workbook(workbook_id: str, user_id: str = Depends(_current_user_id)):\n    try:\n        delete_workbook_for_user(user_id, workbook_id)\n    except WorkbookError as exc:\n        detail = str(exc)\n        if "not found" in detail.lower():\n            raise HTTPException(status_code=404, detail=detail) from exc\n        if _is_server_error(detail):\n            raise HTTPException(status_code=503, detail=detail) from exc\n        raise HTTPException(status_code=400, detail=detail) from exc\n\n\n@router.get("/{workbook_id}/transactions")\ndef get_transactions(\n'''
frontend
backend.write_text(text.replace(needle, replacement))
print('resolved')
