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
    doc["updated_at"] = now
    return doc


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
    latest_summary = None
    if latest_summary_raw:
        latest_summary = {
            "total_entries": int(latest_summary_raw.get("total_entries", 0)),
            "rule_flagged": int(latest_summary_raw.get("rule_flagged", 0)),
            "ml_flagged": int(latest_summary_raw.get("ml_flagged", 0)),
            "total_flagged": int(latest_summary_raw.get("total_flagged", 0)),
            "pct_flagged": float(latest_summary_raw.get("pct_flagged", 0)),
        }

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
        "latest_summary": latest_summary,
    }
