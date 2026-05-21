#!/usr/bin/env python3
"""
Migration script to add os_item_ids column to tasks table
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL or SUPABASE_KEY not found in .env")
    sys.exit(1)

print("Running migration: Adding os_item_ids column to tasks table...")

try:
    # Create Supabase client with service role key for admin access
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Execute raw SQL to add column
    result = supabase.postgrest.auth(SUPABASE_KEY).request(
        "POST",
        "/rpc/exec_sql",
        json={"sql": "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS os_item_ids INTEGER[] DEFAULT '{}';"}
    )
    
    print("✓ Migration completed successfully!")
    
except Exception as e:
    print(f"Note: {str(e)}")
    print("\nAttempting alternative approach using REST API...")
    
    try:
        import requests
        
        # Use Supabase REST API to execute SQL
        headers = {
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json"
        }
        
        sql = "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS os_item_ids INTEGER[] DEFAULT '{}';"
        
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
            headers=headers,
            json={"sql": sql}
        )
        
        if response.status_code in [200, 201]:
            print("✓ Migration completed successfully via REST API!")
        else:
            print(f"✗ REST API error: {response.status_code} - {response.text}")
            
    except Exception as e2:
        print(f"✗ Alternative method failed: {e2}")
        print("\nThe column may already exist or you need to add it manually.")
        print("You can do this via Supabase dashboard > SQL Editor")
