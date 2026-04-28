import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError


MONGO_URI = os.environ.get("MONGO_URI", "")
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "auditdb")

_client: Optional[MongoClient] = None
_db = None


class WorkbookError(Exception):
    pass


def _get_db():
    global _client, _db

    if _db is not None:
        return _db

    if not MONGO_URI:
        raise WorkbookError("MONGO_URI is not configured on the server.")

    try:
        _client = MongoClient(
            MONGO_URI,
            maxPoolSize=20,
            minPoolSize=2,
            maxIdleTimeMS=300000,
            connectTimeoutMS=10000,
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=20000,
        )
        _db = _client[MONGO_DB_NAME]
        _db.command("ping")
        _db.workbooks.create_index([("owner_user_id", 1), ("updated_at", -1)])
        return _db
    except ServerSelectionTimeoutError as exc:
        raise WorkbookError(
            "Database is unreachable. Check MONGO_URI and Atlas IP allowlist/network settings."
        ) from exc
    except PyMongoError as exc:
        raise WorkbookError("Database connection failed. Check MongoDB credentials and URI.") from exc


def _workbooks_collection():
    return _get_db().workbooks


def _coerce_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(value)
    except Exception:
        return None


def create_workbook_for_user(
    user_id: str,
    client_name: str,
    financial_year: str,
    functional_currency: str,
    engagement_type: Optional[str],
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    doc = {
        "owner_user_id": user_id,
        "client_name": client_name.strip(),
        "financial_year": financial_year.strip(),
        "functional_currency": functional_currency.strip(),
        "engagement_type": (engagement_type or "").strip(),
        "status": "Draft",
        "risk_score": 0,
        "created_at": now,
        "updated_at": now,
    }

    try:
        result = _workbooks_collection().insert_one(doc)
    except PyMongoError as exc:
        raise WorkbookError("Unable to save workbook. Database operation failed.") from exc

    doc["_id"] = result.inserted_id
    return doc


def list_workbooks_for_user(user_id: str) -> List[Dict[str, Any]]:
    try:
        return list(_workbooks_collection().find({"owner_user_id": user_id}).sort("updated_at", -1))
    except PyMongoError as exc:
        raise WorkbookError("Unable to fetch workbooks. Database operation failed.") from exc


def get_workbook_for_user(user_id: str, workbook_id: str) -> Dict[str, Any]:
    oid = _coerce_object_id(workbook_id)
    if not oid:
        raise WorkbookError("Invalid workbook id.")

    try:
        doc = _workbooks_collection().find_one({"_id": oid, "owner_user_id": user_id})
    except PyMongoError as exc:
        raise WorkbookError("Unable to fetch workbook. Database operation failed.") from exc

    if not doc:
        raise WorkbookError("Workbook not found.")
    return doc


def save_entity_config_for_user(user_id: str, workbook_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    doc = get_workbook_for_user(user_id, workbook_id)
    now = datetime.now(timezone.utc)

    entity_config = {
        "entity_name": payload.get("entity_name", "").strip(),
        "financial_year": payload.get("financial_year", "").strip(),
        "ledger_type": payload.get("ledger_type", "").strip(),
        "functional_currency": payload.get("functional_currency", "").strip(),
        "reporting_currency": (payload.get("reporting_currency") or "").strip(),
        "company_code": (payload.get("company_code") or "").strip(),
    }

    try:
        _workbooks_collection().update_one(
            {"_id": doc["_id"], "owner_user_id": user_id},
            {
                "$set": {
                    "entity_config": entity_config,
                    "status": "In Progress",
                    "updated_at": now,
                }
            },
        )
    except PyMongoError as exc:
        raise WorkbookError("Unable to save workbook configuration. Database operation failed.") from exc

    doc["entity_config"] = entity_config
    doc["status"] = "In Progress"
    doc["updated_at"] = now
    return doc


def save_analysis_for_user(
    user_id: str,
    workbook_id: str,
    summary: Dict[str, Any],
    category_counts: List[Dict[str, Any]],
    flagged_rows: Optional[List[Dict[str, Any]]] = None,
    review_rows: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    doc = get_workbook_for_user(user_id, workbook_id)
    now = datetime.now(timezone.utc)

    total_flagged = int(summary.get("total_flagged", 0))
    total_entries = int(summary.get("total_entries", 0))
    risk_score = int(round((total_flagged / total_entries) * 100)) if total_entries > 0 else 0
    risk_score = max(0, min(risk_score, 100))

    latest_summary = {
        "total_entries": total_entries,
        "rule_flagged": int(summary.get("rule_flagged", 0)),
        "ml_flagged": int(summary.get("ml_flagged", 0)),
        "total_flagged": total_flagged,
        "pct_flagged": float(summary.get("pct_flagged", 0)),
    }

    try:
        _workbooks_collection().update_one(
            {"_id": doc["_id"], "owner_user_id": user_id},
            {
                "$set": {
                    "status": "Completed" if total_flagged == 0 else "In Progress",
                    "risk_score": risk_score,
                    "latest_summary": latest_summary,
                    "latest_category_counts": category_counts,
                    "flagged_rows": flagged_rows or [],
                    "review_rows": review_rows or [],
                    "updated_at": now,
                }
            },
        )
    except PyMongoError as exc:
        raise WorkbookError("Unable to save workbook analysis. Database operation failed.") from exc

    doc["status"] = "Completed" if total_flagged == 0 else "In Progress"
    doc["risk_score"] = risk_score
    doc["latest_summary"] = latest_summary
    doc["latest_category_counts"] = category_counts
    doc["flagged_rows"] = flagged_rows or []
    doc["review_rows"] = review_rows or []
    doc["updated_at"] = now
    return doc


def _is_date_in_range(date_str: str, start_date: Optional[str], end_date: Optional[str]) -> bool:
    """Check if a date falls within a range."""
    try:
        if not date_str:
            return False
        row_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            if row_date < start:
                return False
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            if row_date > end:
                return False
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _is_amount_in_range(row: Dict[str, Any], min_amt: float, max_amt: float) -> bool:
    """Check if transaction amount is within range."""
    try:
        debit = float(row.get("debit", 0) or 0)
        credit = float(row.get("credit", 0) or 0)
        amount = debit or credit
        return min_amt <= amount <= max_amt
    except (ValueError, TypeError):
        return False


def query_transactions_for_user(
    user_id: str,
    workbook_id: str,
    filters: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Query and filter transactions from a workbook's analysis."""
    doc = get_workbook_for_user(user_id, workbook_id)
    
    # Get all transactions (flagged rows contain the anomalies)
    all_rows = doc.get("flagged_rows", [])
    if not all_rows:
        return []
    
    filtered_rows = all_rows
    
    # Apply date range filter
    if "start_date" in filters or "end_date" in filters:
        start_date = filters.get("start_date")
        end_date = filters.get("end_date")
        filtered_rows = [
            row for row in filtered_rows
            if _is_date_in_range(row.get("date"), start_date, end_date)
        ]
    
    # Apply account filter
    if "accounts" in filters and filters["accounts"]:
        account_list = filters["accounts"]
        filtered_rows = [
            row for row in filtered_rows
            if any(acc.lower() in str(row.get("account_name", "")).lower() for acc in account_list)
        ]
    
    # Apply amount range filter
    if "min_amount" in filters or "max_amount" in filters:
        min_amt = filters.get("min_amount", 0)
        max_amt = filters.get("max_amount", float('inf'))
        filtered_rows = [
            row for row in filtered_rows
            if _is_amount_in_range(row, min_amt, max_amt)
        ]
    
    # Apply category filter
    if "categories" in filters and filters["categories"]:
        cat_list = filters["categories"]
        filtered_rows = [
            row for row in filtered_rows
            if any(cat.lower() in str(row.get("scrutiny_category", "")).lower() for cat in cat_list)
        ]
    
    # Apply text search in narration
    if "search_text" in filters and filters["search_text"]:
        search_term = filters["search_text"].lower()
        filtered_rows = [
            row for row in filtered_rows
            if search_term in str(row.get("narration", "")).lower()
        ]
    
    return filtered_rows


def to_public_workbook(doc: Dict[str, Any]) -> Dict[str, Any]:
    updated_at = doc.get("updated_at")
    if isinstance(updated_at, datetime):
        last_modified = updated_at.astimezone(timezone.utc).isoformat()
    else:
        last_modified = datetime.now(timezone.utc).isoformat()

    entity_config_raw = doc.get("entity_config") if isinstance(doc.get("entity_config"), dict) else None
    entity_config = None
    if entity_config_raw:
        entity_config = {
            "entity_name": str(entity_config_raw.get("entity_name", "")),
            "financial_year": str(entity_config_raw.get("financial_year", "")),
            "ledger_type": str(entity_config_raw.get("ledger_type", "")),
            "functional_currency": str(entity_config_raw.get("functional_currency", "")),
            "reporting_currency": str(entity_config_raw.get("reporting_currency", "")).strip() or None,
            "company_code": str(entity_config_raw.get("company_code", "")).strip() or None,
        }

    latest_summary_raw = doc.get("latest_summary") if isinstance(doc.get("latest_summary"), dict) else None
    analysis_summary = None
    if latest_summary_raw:
        analysis_summary = {
            "total_entries": int(latest_summary_raw.get("total_entries", 0)),
            "rule_flagged": int(latest_summary_raw.get("rule_flagged", 0)),
            "ml_flagged": int(latest_summary_raw.get("ml_flagged", 0)),
            "total_flagged": int(latest_summary_raw.get("total_flagged", 0)),
            "pct_flagged": float(latest_summary_raw.get("pct_flagged", 0)),
        }

    category_counts = []
    if isinstance(doc.get("latest_category_counts"), list):
        category_counts = doc.get("latest_category_counts", [])

    return {
        "id": str(doc.get("_id", "")),
        "client_name": doc.get("client_name", ""),
        "financial_year": doc.get("financial_year", ""),
        "functional_currency": doc.get("functional_currency", ""),
        "engagement_type": doc.get("engagement_type", ""),
        "status": doc.get("status", "Draft"),
        "last_modified": last_modified,
        "risk_score": int(doc.get("risk_score", 0)),
        "has_entity_config": bool(entity_config),
        "entity_config": entity_config,
        "analysis_summary": analysis_summary,
        "category_counts": category_counts,
    }
