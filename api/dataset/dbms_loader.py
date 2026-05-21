"""Load and query the DBMS study-items catalog."""
import os
from typing import List, Optional
import json

import pandas as pd

_DBMS_DF: Optional[pd.DataFrame] = None
_DBMS_ITEMS_CACHE: Optional[List[dict]] = None

DBMS_TOPICS: List[str] = [
    "DBMS Introduction",
    "Database Models",
    "SQL Basics",
    "Database Design",
    "Transactions",
    "Query Optimization",
    "Database Administration",
    "DBMS Architecture",
    "Advanced Topics",
]

DIFF_MAP = {"Easy": "Easy", "Medium": "Medium", "Hard": "Hard"}


def normalize_topic(topic: str) -> str:
    return topic.lower().rstrip("s")


def get_dbms_items_from_json() -> List[dict]:
    """Load DBMS items from JSON file."""
    global _DBMS_ITEMS_CACHE
    if _DBMS_ITEMS_CACHE is None:
        path = os.path.join(os.path.dirname(__file__), "dbms-study-items.json")
        try:
            with open(path, 'r', encoding='utf-8') as f:
                _DBMS_ITEMS_CACHE = json.load(f)
        except Exception as e:
            print(f"Warning: Could not load DBMS items from JSON: {e}")
            _DBMS_ITEMS_CACHE = []
    return _DBMS_ITEMS_CACHE


def get_dbms_dataframe() -> pd.DataFrame:
    global _DBMS_DF
    if _DBMS_DF is None:
        path = os.path.join(os.path.dirname(__file__), "dbms-study-items.csv")
        _DBMS_DF = pd.read_csv(path)
        _DBMS_DF["normalized_topic"] = _DBMS_DF["topic"].apply(
            lambda x: normalize_topic(str(x).strip()) if pd.notna(x) else ""
        )
    return _DBMS_DF


def hydrate_dbms_items(item_ids: List[int]) -> List[dict]:
    if not item_ids:
        return []
    
    # Load from JSON first (faster and no dependencies)
    items_json = get_dbms_items_from_json()
    if items_json:
        items_by_id = {item["id"]: item for item in items_json}
        order = {int(i): idx for idx, i in enumerate(item_ids)}
        items = [items_by_id[int(i)] for i in item_ids if int(i) in items_by_id]
        items.sort(key=lambda x: order.get(x["id"], 9999))
        return items
    
    # Fallback to CSV-based approach
    df = get_dbms_dataframe()
    rows = df[df["id"].isin(item_ids)]
    order = {int(i): idx for idx, i in enumerate(item_ids)}
    items = []
    for _, row in rows.iterrows():
        rid = int(row["id"])
        items.append({
            "id": rid,
            "title": str(row["title"]),
            "type": str(row["type"]),
            "topic": str(row["topic"]),
            "difficulty": str(row["difficulty"]),
            "body": str(row["body"]) if pd.notna(row.get("body")) else "",
            "url": str(row["url"]) if pd.notna(row.get("url")) and str(row["url"]).strip() else None,
            "estimated_minutes": int(row["estimated_minutes"]) if pd.notna(row.get("estimated_minutes")) else 25,
            "lecture": str(row["lecture"]) if pd.notna(row.get("lecture")) else "",
        })
    items.sort(key=lambda x: order.get(x["id"], 9999))
    return items


def get_dbms_item_by_id(item_id: int) -> Optional[dict]:
    items = hydrate_dbms_items([item_id])
    return items[0] if items else None
