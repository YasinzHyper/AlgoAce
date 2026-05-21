#!/usr/bin/env python3
"""
Seed OS study items from CSV to Supabase.
Creates the os_study_items table and populates it.
"""
import os
import sys
import csv
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env")
    sys.exit(1)

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Starting OS study items seeding...")

# 1. Ensure table exists
try:
    print("\n1. Checking/creating os_study_items table...")
    # Try to query the table first
    result = supabase.table("os_study_items").select("*").limit(1).execute()
    print("   Table already exists")
except Exception as e:
    print(f"   Table doesn't exist or error: {e}")
    print("   (Will be created when data is inserted)")

# 2. Load CSV data
csv_path = os.path.join(os.path.dirname(__file__), "..", "dataset", "os-study-items.csv")

print(f"\n2. Reading OS study items from {csv_path}...")

items = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        item = {
            "id": int(row["id"]),
            "title": row["title"],
            "type": row["type"],
            "topic": row["topic"],
            "difficulty": row["difficulty"],
            "body": row.get("body", "") or None,
            "url": row.get("url", "") or None,
            "estimated_minutes": int(row["estimated_minutes"]) if row.get("estimated_minutes") else 25,
            "lecture": row.get("lecture", "") or None,
        }
        items.append(item)

print(f"   Loaded {len(items)} items from CSV")

# 3. Upsert to Supabase (if table exists, skip duplicates; if not, create)
print("\n3. Upserting to os_study_items table...")

try:
    # Try to insert with upsert (on conflict, do nothing - assuming id is primary key)
    response = supabase.table("os_study_items").upsert(items, ignore_duplicates=True).execute()
    print(f"   SUCCESS: Upserted {len(items)} items")
    print(f"   Response data count: {len(response.data) if response.data else 0}")
except Exception as e:
    print(f"   ERROR upserting: {e}")
    print(f"   Trying batch insert...")
    
    # Fall back to batch insert in chunks of 1000
    batch_size = 1000
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        try:
            response = supabase.table("os_study_items").insert(batch).execute()
            print(f"   Batch {i//batch_size + 1}: {len(batch)} items inserted")
        except Exception as e2:
            print(f"   ERROR on batch {i//batch_size + 1}: {e2}")

# 4. Add os_item_ids column to tasks if not exists
print("\n4. Ensuring tasks table has os_item_ids column...")

try:
    # Try to query a task and see if os_item_ids is there
    result = supabase.table("tasks").select("*").limit(1).execute()
    if result.data and "os_item_ids" in result.data[0]:
        print("   Column os_item_ids already exists")
    else:
        print("   Column missing - needs to be added manually in Supabase SQL editor")
        print("   Run: ALTER TABLE tasks ADD COLUMN IF NOT EXISTS os_item_ids bigint[] DEFAULT '{}';")
except Exception as e:
    print(f"   Error checking column: {e}")

print("\n✓ Seeding complete!")
print("\nNext steps:")
print("1. Go to Supabase Dashboard > SQL Editor")
print("2. Run: ALTER TABLE tasks ADD COLUMN IF NOT EXISTS os_item_ids bigint[] DEFAULT '{}';")
print("3. Restart your backend server")
