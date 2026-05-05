from pathlib import Path
path = Path('backend/routers/workbooks.py')
text = path.read_text()
old = '''@router.delete("/{workbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workbook(workbook_id: str, user_id: str = Depends(_current_user_id)):
    try:
        delete_workbook_for_user(user_id, workbook_id)


@router.get("/{workbook_id}/transactions")'''
new = '''@router.delete("/{workbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workbook(workbook_id: str, user_id: str = Depends(_current_user_id)):
    try:
        delete_workbook_for_user(user_id, workbook_id)
    except WorkbookError as exc:
        detail = str(exc)
        if "not found" in detail.lower():
            raise HTTPException(status_code=404, detail=detail) from exc
        if _is_server_error(detail):
            raise HTTPException(status_code=503, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc


@router.get("/{workbook_id}/transactions")'''
if old not in text:
    raise SystemExit('needle not found')
path.write_text(text.replace(old, new))
print('done')
