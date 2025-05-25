from config import SUPABASE_KEY
from config import SUPABASE_URL

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
# user = supabase.auth.get_user()  # Check if a user is logged in
# print(f"Authenticated user ID: {user.user.id}")