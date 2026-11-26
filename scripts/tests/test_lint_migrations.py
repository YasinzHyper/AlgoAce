"""Tests for scripts/lint_migrations.py. Run from the repository root:

    python -m pytest -q scripts/tests
"""

import re
import subprocess

import pytest
from lint_migrations import LintError, Tok, lint_changes, run, split_statements

BASELINE ="supabase/migrations/20261121000000_baseline.sql"
NEW = "supabase/migrations/20261201000000_add_notes.sql"

# A cut-down baseline with the shapes production has.
BASELINE_SQL = """
-- For local and CI databases only: production already has this schema.
CREATE TABLE public.users (id uuid NOT NULL, display_name text, CONSTRAINT users_pkey PRIMARY KEY (id));
CREATE TABLE public.roadmaps (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT roadmaps_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.challenges (id bigint NOT NULL, user_id uuid NOT NULL);
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_period text DEFAULT 'week', p_limit integer DEFAULT 100)
RETURNS TABLE (user_id uuid, points bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT c.user_id, 0::bigint FROM public.challenges c; -- a ; inside the body
END;
$$;
CREATE FUNCTION public.refresh_user_streak(p_user_id uuid) RETURNS void LANGUAGE sql AS 'SELECT 1';
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.get_leaderboard(text, integer) FROM public, anon, authenticated;
"""


def lint(sql):
    """Lint one added migration against the baseline and return the problems."""
    problems, checked = lint_changes([("A", NEW)], {BASELINE: BASELINE_SQL}, {NEW: sql})
    assert checked == [NEW]
    return problems


# Splitting into statements


def test_semicolons_inside_strings_names_comments_and_bodies_do_not_split():
    sql = (
        "SELECT ';';\n"
        'SELECT "a;b";\n'
        "-- a ; comment\n"
        "SELECT 1 /* outer ; /* nested ; */ still ; */;\n"
        "SELECT $fn$ ; $$ ; $fn$;\n"
        r"SELECT E'it\'s; fine';" "\n"
        "SELECT 'it''s; fine'"
    )
    statements = split_statements(sql)
    assert [st.text for st in statements] == [
        "SELECT ';'",
        'SELECT "a;b"',
        "SELECT 1",
        "SELECT $fn$ ; $$ ; $fn$",
        r"SELECT E'it\'s; fine'",
        "SELECT 'it''s; fine'",
    ]
    assert [st.line for st in statements] == [1, 2, 4, 5, 6, 7]
    assert statements[3].tokens[1] == Tok("body", " ; $$ ; ")


def test_a_statement_split_across_lines_keeps_its_first_line_and_loses_its_comments():
    sql = "-- header\n\nCREATE TABLE IF NOT EXISTS t (\n  a int -- note\n);\n"
    [st] = split_statements(sql)
    assert st.line == 3
    assert [t.value for t in st.tokens] == ["create", "table", "if", "not", "exists", "t", "(", "a", "int", ")"]


def test_a_last_statement_without_a_semicolon_counts_and_empty_ones_do_not():
    assert [st.text for st in split_statements(";;SELECT 1;; SELECT 2")] == ["SELECT 1", "SELECT 2"]
    assert split_statements("-- only a comment\n/* and another */\n") == []


def test_words_are_lower_cased_and_quoted_names_keep_their_case():
    [st] = split_statements('ALTER TABLE "Public"."My""Table" ENABLE ROW LEVEL SECURITY')
    assert st.tokens[0] == Tok("word", "alter")
    assert st.tokens[2] == Tok("name", "Public")
    assert st.tokens[4] == Tok("name", 'My"Table')


@pytest.mark.parametrize(
    "sql",
    ["SELECT 'abc", 'SELECT "abc', "SELECT $$ abc", "SELECT $body$ abc $$", "/* abc", "/* a /* b */", r"SELECT E'a\'"],
)
def test_unclosed_quotes_and_comments_are_errors(sql):
    with pytest.raises(LintError, match="never closed"):
        split_statements(sql)


def test_a_carriage_return_ends_a_line_comment_and_a_line():
    statements = split_statements("SELECT 1; -- a\rSELECT 2;\r\nSELECT 3")
    assert [st.text for st in statements] == ["SELECT 1", "SELECT 2", "SELECT 3"]
    assert [st.line for st in statements] == [1, 2, 3]


@pytest.mark.parametrize(
    "sql, error",
    [
        ("SELECT 'a' 'b'", "line 1: two string constants in a row"),
        ("SELECT E'a'\n  'b'", "line 2: two string constants in a row"),
        ("SELECT 'a' /* x */ -- y\n'b'", "line 2: two string constants in a row"),
        ("SELECT caf\u00e9", "line 1: U+00E9 is outside a string, quoted name or comment"),
        ("SELECT $\u00e9$ x $\u00e9$", "line 1: U+00E9 is outside a string, quoted name or comment"),
        ("SELECT 1;\n\u00a0SELECT 2", "line 2: U+00A0 is outside a string, quoted name or comment"),
        ("\ufeffSELECT 1", "line 1: U+FEFF is outside a string, quoted name or comment"),
        ("SELECT 1\v", "line 1: U+000B is outside a string, quoted name or comment"),
        ('SELECT U&"a"', 'line 1: U&" starts a name or string with Unicode escapes'),
        ("SELECT 1;\nSELECT u&'\\0041'", "line 2: u&' starts a name or string with Unicode escapes"),
        ("SELECT 'a\\b'", "line 1: a backslash in a string not written E'...'"),
        ("SELECT 'it''s',\n  'C:\\\\'", "line 2: a backslash in a string not written E'...'"),
        ("SELECT 1e5$a$ ' $a$", "line 1: a number directly followed by a letter, _ or $"),
        ("SELECT 1x", "line 1: a number directly followed by a letter, _ or $"),
        ("SELECT 1_000", "line 1: a number directly followed by a letter, _ or $"),
        ("SELECT 1e'a'", "line 1: a number directly followed by a letter, _ or $"),
        ("SELECT .5e", "line 1: a number directly followed by a letter, _ or $"),
    ],
)
def test_text_that_postgres_could_read_differently_is_an_error(sql, error):
    with pytest.raises(LintError, match=re.escape(error)):
        split_statements(sql)


def test_numbers_are_one_token_and_u_is_a_name_when_no_quote_follows_the_ampersand():
    [st] = split_statements("SELECT 1.5e3, .5, 1e-2, 2., $1, 10, u & 1, menu&\"x\", E'a\\\\b'")
    assert [tok.value for tok in st.tokens if tok.value != ","] == [
        "select", "1.5e3", ".5", "1e-2", "2.", "$1", "10", "u", "&", "1", "menu", "&", "x", "E'a\\\\b'",
    ]
    assert {tok.kind for tok in st.tokens if tok.value[0].isdigit() or tok.value[0] in ".$"} == {"punct"}


# Statements that only add

PASSES = {
    "a new table with indexes, row-level security, a policy, grants and comments": """
        CREATE TABLE IF NOT EXISTS public.notes (
          id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
          user_id uuid NOT NULL DEFAULT auth.uid(),
          roadmap_id bigint NOT NULL,
          body text CHECK (body IS NOT NULL AND length(body) < 2000),
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          CONSTRAINT notes_pkey PRIMARY KEY (id),
          CONSTRAINT notes_roadmap_id_fkey
            FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_notes_user ON public.notes (user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notes_roadmap ON ONLY notes USING btree (roadmap_id) WHERE body <> '';
        ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Owners read their notes" ON public.notes
          FOR SELECT TO authenticated USING (auth.uid() = user_id);
        GRANT SELECT, INSERT (body) ON TABLE public.notes TO service_role;
        GRANT ALL ON notes TO service_role WITH GRANT OPTION;
        COMMENT ON TABLE public.notes IS 'One note per roadmap; DROP nothing.';
        COMMENT ON COLUMN public.users.display_name IS 'Shown on the leaderboard';
    """,
    "new columns on existing tables that are nullable or have a default": """
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio text;
        ALTER TABLE IF EXISTS ONLY public.roadmaps
          ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
          ADD COLUMN IF NOT EXISTS tag text CHECK (tag IS NOT NULL OR tag IS NULL),
          ADD COLUMN IF NOT EXISTS sort_key bigint NOT NULL GENERATED ALWAYS AS IDENTITY,
          ADD COLUMN IF NOT EXISTS seq bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY,
          ADD COLUMN IF NOT EXISTS rank int NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS status text DEFAULT 'new' NOT NULL,
          ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS editor_id uuid NOT NULL DEFAULT gen_random_uuid()
            REFERENCES public.users(id) ON DELETE SET DEFAULT;
    """,
    "numbers, a backslash in an E'...' string, and & after a name": """
        CREATE TABLE IF NOT EXISTS public.scores (
          u int CHECK (u & 1 = 0),
          ratio numeric(6, 2) CHECK (ratio <= 1.5e3 AND ratio >= .5 AND ratio <> 1e-2),
          label text DEFAULT E'a\\\\b'
        );
        ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
        CREATE POLICY p ON scores AS PERMISSIVE FOR SELECT USING (u > 0);
        CREATE POLICY q ON scores;
        CREATE INDEX IF NOT EXISTS i ON ONLY scores (u);
    """,
    "new functions whose bodies would not pass, and a grant on them": """
        CREATE OR REPLACE FUNCTION public.count_notes(p_user_id uuid)
        RETURNS integer
        LANGUAGE plpgsql
        AS $body$
        BEGIN
          DELETE FROM public.notes WHERE false; -- runs when called, not when migrating
          DROP TABLE IF EXISTS scratch;
          RETURN (SELECT count(*) FROM public.users WHERE id = p_user_id);
        END;
        $body$;
        CREATE FUNCTION count_users() RETURNS bigint LANGUAGE sql AS 'SELECT count(*) FROM public.users; -- ;';
        GRANT EXECUTE ON FUNCTION public.count_notes(uuid), count_users() TO service_role;
    """,
    "quoted and differently cased names": """
        CREATE TABLE IF NOT EXISTS "public"."Badges" (id int);
        ALTER TABLE public."Badges" ENABLE ROW LEVEL SECURITY;
        create table if not exists Public.Streak_Log (id int);
        alter table streak_log enable row level security;
    """,
    "comments that mention statements which would fail": """
        -- DROP TABLE public.users;
        /* UPDATE public.users SET display_name = NULL; /* nested */ */
        CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users (display_name);
    """,
    "a migration with no statements": "-- nothing yet\n",
    "characters outside ASCII inside strings, quoted names, comments and bodies": """
        -- Caf\u00e9 \u00d7 \u00bd
        /* na\u00efve */
        CREATE TABLE IF NOT EXISTS public."\u00dcn\u00efcode" (id int, label text CHECK (label IN ('\u00d7', '\u00bd')));
        ALTER TABLE public."\u00dcn\u00efcode" ENABLE ROW LEVEL SECURITY;
        COMMENT ON TABLE public.users IS E'Line\\n\u00e9';
        CREATE FUNCTION public.greet() RETURNS text LANGUAGE sql AS $$ SELECT 'h\u00e9llo' $$;
    """,
    "CRLF line endings, tabs and form feeds": "COMMENT ON TABLE users IS 'x';\r\n\f\tCREATE INDEX IF NOT EXISTS i ON users (id);\r\n",
}


@pytest.mark.parametrize("sql", PASSES.values(), ids=PASSES.keys())
def test_additive_migrations_pass(sql):
    assert lint(sql) == []


# Statements that do not only add

NOT_ADDITIVE = "not one of the additive forms"
ALTER_TABLE = "ALTER TABLE accepts only ADD COLUMN IF NOT EXISTS"
GRANT = "GRANT is accepted only on a table or function created in the same file"
SAME_FILE = "only for a table created in the same file"
NOT_PUBLIC = "outside the public schema"
UNREADABLE = "could not read the name"
EXISTS = "already exists"

FAILS = [
    ("DROP TABLE public.users;", NOT_ADDITIVE),
    ("DROP INDEX IF EXISTS idx_users;", NOT_ADDITIVE),
    ("ALTER TABLE public.users RENAME TO people;", ALTER_TABLE),
    ("ALTER TABLE public.users RENAME COLUMN display_name TO handle;", ALTER_TABLE),
    ("ALTER TABLE public.users ALTER COLUMN display_name SET NOT NULL;", ALTER_TABLE),
    ("ALTER TABLE public.users ALTER COLUMN display_name TYPE varchar(40);", ALTER_TABLE),
    ("ALTER TABLE public.users DROP COLUMN display_name;", ALTER_TABLE),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS a text, DROP COLUMN display_name;", ALTER_TABLE),
    ("ALTER TABLE public.users ADD COLUMN bio text;", ALTER_TABLE),
    ("ALTER TABLE public.users ADD CONSTRAINT users_name_check CHECK (length(display_name) > 0);", ALTER_TABLE),
    ("ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;", ALTER_TABLE),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level int NOT NULL;", "is NOT NULL and has no default"),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS code text PRIMARY KEY;", "is NOT NULL and has no default"),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level int NOT NULL DEFAULT NULL;", "is NOT NULL and has no default"),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level int DEFAULT null::int NOT NULL;", "is NOT NULL and has no default"),
    ("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level int CONSTRAINT generated NOT NULL;", "is NOT NULL and has no default"),
    (
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS owner uuid NOT NULL REFERENCES public.users(id) ON DELETE SET DEFAULT;",
        "is NOT NULL and has no default",
    ),
    ("ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;", SAME_FILE),
    ("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS bio text;", NOT_PUBLIC),
    ("ALTER TABLE postgres.auth.users ADD COLUMN IF NOT EXISTS bio text;", UNREADABLE),
    ("CREATE TABLE IF NOT EXISTS postgres.auth.sessions_copy (id uuid);", UNREADABLE),
    ("CREATE INDEX IF NOT EXISTS idx_auth ON postgres.auth.users (email);", UNREADABLE),
    ("CREATE FUNCTION postgres.auth.helper() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;", UNREADABLE),
    ("TRUNCATE public.users;", NOT_ADDITIVE),
    ("DELETE FROM public.users WHERE id IS NULL;", NOT_ADDITIVE),
    ("UPDATE public.users SET display_name = NULL;", NOT_ADDITIVE),
    ("INSERT INTO public.users (id) VALUES ('00000000-0000-0000-0000-000000000000');", NOT_ADDITIVE),
    ("CREATE OR REPLACE FUNCTION public.get_leaderboard(p text, l integer) RETURNS void AS $$ SELECT 1 $$;", EXISTS),
    ("CREATE FUNCTION get_leaderboard(p_extra boolean) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;", EXISTS),
    ("CREATE FUNCTION auth.helper() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;", NOT_PUBLIC),
    ("CREATE OR REPLACE PROCEDURE public.tidy() LANGUAGE sql AS $$ SELECT 1 $$;", NOT_ADDITIVE),
    ("CREATE TABLE public.notes (id int);", "CREATE TABLE must say IF NOT EXISTS"),
    ("CREATE TABLE IF NOT EXISTS public.users (id uuid);", EXISTS),
    ("CREATE TABLE IF NOT EXISTS auth.users (id uuid);", NOT_PUBLIC),
    ("CREATE TABLE IF NOT EXISTS public.copy AS SELECT * FROM public.users;", "only CREATE TABLE IF NOT EXISTS"),
    ("CREATE TABLE IF NOT EXISTS public.kids (id int) INHERITS (public.users);", "only CREATE TABLE IF NOT EXISTS"),
    ("CREATE UNLOGGED TABLE IF NOT EXISTS public.cache (k text);", NOT_ADDITIVE),
    ("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON public.users (display_name);", NOT_ADDITIVE),
    ("CREATE INDEX idx_users_name ON public.users (display_name);", "only CREATE INDEX IF NOT EXISTS"),
    ("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_name ON public.users (display_name);", "only CREATE INDEX"),
    ("CREATE INDEX IF NOT EXISTS idx_auth ON auth.users (email);", NOT_PUBLIC),
    ("CREATE POLICY open ON public.users FOR SELECT USING (true);", SAME_FILE),
    ("ALTER POLICY open ON public.users USING (true);", NOT_ADDITIVE),
    ("DROP POLICY IF EXISTS open ON public.users;", NOT_ADDITIVE),
    ("REVOKE ALL ON public.users FROM anon;", NOT_ADDITIVE),
    ("GRANT SELECT ON public.users TO anon;", GRANT),
    ("GRANT SELECT ON TABLE public.users, public.roadmaps TO anon;", GRANT),
    ("GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO anon;", GRANT),
    ("GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;", GRANT),
    ("GRANT USAGE ON SCHEMA public TO anon;", GRANT),
    ("GRANT service_role TO authenticated;", GRANT),
    ("DO $$ BEGIN DELETE FROM public.users; END $$;", NOT_ADDITIVE),
    ("CREATE OR REPLACE VIEW public.user_names AS SELECT display_name FROM public.users;", NOT_ADDITIVE),
    ("CREATE TRIGGER t AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.f();", NOT_ADDITIVE),
    ("SELECT public.refresh_user_streak(id) FROM public.users;", NOT_ADDITIVE),
    ("SET search_path = auth;", NOT_ADDITIVE),
    ("BEGIN;", NOT_ADDITIVE),
]


@pytest.mark.parametrize("sql, reason", FAILS)
def test_statements_that_do_not_only_add_fail_and_are_quoted(sql, reason):
    problems = lint(sql)
    assert len(problems) == 1
    assert f"{NEW}, line 1: " in problems[0]
    assert reason in problems[0]
    assert problems[0].endswith("\n    " + sql.rstrip(";"))


def test_a_grant_on_every_table_fails_even_when_the_file_creates_a_table_called_all():
    problems = lint(
        'CREATE TABLE IF NOT EXISTS "all" (id int);\n'
        "GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;\n"
        'GRANT SELECT ON "all" TO service_role;\n'
    )
    assert problems == [f"{NEW}, line 2: {GRANT}\n    GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon"]


def test_a_grant_names_only_functions_and_their_arguments():
    problems = lint(
        "CREATE FUNCTION public.count_notes(p uuid) RETURNS int LANGUAGE sql AS 'SELECT 1';\n"
        "GRANT EXECUTE ON FUNCTION public.count_notes(uuid) TO service_role;\n"
        "GRANT EXECUTE ON FUNCTION public.count_notes(uuid) extra TO service_role;\n"
    )
    assert len(problems) == 1 and problems[0].startswith(f"{NEW}, line 3: {GRANT}")


def test_a_problem_quotes_a_statement_split_across_lines_from_its_first_line():
    sql = "CREATE INDEX IF NOT EXISTS i ON public.users (id);\n\nDROP -- why\n  TABLE /* gone */\n  public.users;\n"
    assert lint(sql) == [f"{NEW}, line 3: {NOT_ADDITIVE}\n    DROP -- why TABLE /* gone */ public.users"]


def test_every_failing_statement_is_reported():
    problems = lint("DROP TABLE a; CREATE INDEX IF NOT EXISTS i ON users (id); TRUNCATE b;")
    assert [p.splitlines()[1].strip() for p in problems] == ["DROP TABLE a", "TRUNCATE b"]


def test_long_statements_are_shortened_in_the_report():
    [problem] = lint("DO $$ " + "x" * 500 + " $$;")
    quoted = problem.splitlines()[1]
    assert quoted.endswith(" ...") and len(quoted) < 220


def test_an_unclosed_quote_in_an_added_migration_fails():
    problems = lint("COMMENT ON TABLE users IS 'oops;")
    assert len(problems) == 1 and "never closed" in problems[0]


# Text that PostgreSQL runs, written so that a reader with other token rules takes it for part
# of a string or a comment. Each must fail, from the SQL here and from the bytes of a file below.
JOINED = "two string constants in a row"
NOT_ASCII = "is outside a string, quoted name or comment"
UNICODE = "starts a name or string with Unicode escapes"
BACKSLASH = "a backslash in a string not written E'...'"
TABLE_U = "CREATE TABLE IF NOT EXISTS u (id int);\nALTER TABLE u ENABLE ROW LEVEL SECURITY;\n"
HIDDEN = [
    ("-- tidy up\rDROP TABLE public.users;\n", f"{NEW}, line 2: {NOT_ADDITIVE}\n    DROP TABLE public.users"),
    ("COMMENT ON TABLE users IS E'a'\n'b\\' c '; DROP TABLE users; --';\n", f"{NEW}: line 2: {JOINED}"),
    ("COMMENT ON TABLE users IS E'a' -- why\n'b\\' c '; DROP TABLE users; --';\n", f"{NEW}: line 2: {JOINED}"),
    ("COMMENT ON TABLE users IS E'a'\r\n'b\\' c '; DROP TABLE users; --';\r\n", f"{NEW}: line 2: {JOINED}"),
    ("COMMENT ON TABLE users IS E'a'\r'b\\' c '; DROP TABLE users; --';\n", f"{NEW}: line 2: {JOINED}"),
    ("COMMENT ON TABLE users IS $\u00d7$ ' $\u00d7$; DROP TABLE users; --';\n", f"{NEW}: line 1: U+00D7 {NOT_ASCII}"),
    ("COMMENT ON TABLE users IS $\u00a0$ ' $\u00a0$; DROP TABLE users; --';\n", f"{NEW}: line 1: U+00A0 {NOT_ASCII}"),
    ("COMMENT ON TABLE users IS $\u0661$ ' $\u0661$; DROP TABLE users; --';\n", f"{NEW}: line 1: U+0661 {NOT_ASCII}"),
    # U&"users" is the table users, not a name u followed by & and "users".
    (TABLE_U + 'CREATE POLICY read_all ON U&"users" FOR SELECT USING (true);\n', f'{NEW}: line 3: U&" {UNICODE}'),
    (TABLE_U + 'CREATE POLICY read_all ON U&"\\0075sers" FOR SELECT USING (true);\n', f'{NEW}: line 3: U&" {UNICODE}'),
    (TABLE_U + "CREATE POLICY r ON U&\"!0075sers\" UESCAPE '!' FOR SELECT USING (true);\n", f'{NEW}: line 3: U&" {UNICODE}'),
    ('CREATE INDEX IF NOT EXISTS i ON u&"auth".users (id);\n', f'{NEW}: line 1: u&" {UNICODE}'),
    # With standard_conforming_strings off, \' is a quote and the string ends after 'a\''.
    ("COMMENT ON TABLE users IS 'a\\''; DROP TABLE users; --';\n", f"{NEW}: line 1: {BACKSLASH}"),
]


@pytest.mark.parametrize("sql, problem", HIDDEN)
def test_text_postgres_runs_is_never_read_as_a_string_or_a_comment(sql, problem):
    problems = lint(sql)
    assert len(problems) == 1 and problems[0].startswith(problem)


def test_a_policy_or_index_whose_table_name_is_read_only_in_part_fails():
    problems = lint(
        TABLE_U + 'CREATE POLICY read_all ON u & "users" FOR SELECT USING (true);\n'
        'CREATE INDEX IF NOT EXISTS i ON u & "auth".users (id);\n'
        "CREATE POLICY read_own ON u FOR SELECT USING (true);\n"
        "CREATE INDEX IF NOT EXISTS j ON u USING btree (id);\n"
    )
    assert [p.splitlines()[0] for p in problems] == [
        f"{NEW}, line 3: could not read the table name",
        f"{NEW}, line 4: could not read the table name",
    ]


def test_row_level_security_and_policies_belong_to_the_file_that_creates_the_table():
    second = "supabase/migrations/20261202000000_secure_notes.sql"
    problems, checked = lint_changes(
        [("A", NEW), ("A", second)],
        {BASELINE: BASELINE_SQL},
        {
            NEW: "CREATE TABLE IF NOT EXISTS public.notes (id int);",
            second: "ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;\n"
            "CREATE TABLE IF NOT EXISTS public.notes (id int);",
        },
    )
    assert checked == [NEW, second]
    assert [p.split(": ", 1)[1].splitlines()[0] for p in problems] == [
        "ENABLE ROW LEVEL SECURITY is accepted only for a table created in the same file",
        "public.notes already exists, so IF NOT EXISTS would skip it",
    ]


# Which files are checked


def test_a_change_that_adds_no_migration_passes():
    assert lint_changes([], {BASELINE: BASELINE_SQL}, {}) == ([], [])


@pytest.mark.parametrize("status", ["M", "D", "T"])
def test_a_migration_already_on_the_base_commit_is_never_changed_or_removed(status):
    old = "supabase/migrations/20261125000000_add_bio.sql"
    base = {BASELINE: BASELINE_SQL, old: "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;"}
    head = {old: "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio varchar(80);"} if status == "M" else {}
    assert lint_changes([(status, old)], base, head) == (
        [f"{old}: a migration that is already on the base commit is never changed or removed"],
        [],
    )


def test_the_baseline_is_exempt_when_it_is_added_and_when_it_is_edited():
    assert lint_changes([("A", BASELINE)], {}, {BASELINE: BASELINE_SQL}) == ([], [])
    edited = BASELINE_SQL + "DROP TABLE public.challenges;"
    assert lint_changes([("M", BASELINE)], {BASELINE: BASELINE_SQL}, {BASELINE: edited}) == ([], [])


def test_removing_the_baseline_fails():
    problems, _ = lint_changes([("D", BASELINE)], {BASELINE: BASELINE_SQL}, {})
    assert problems == [f"{BASELINE}: a migration that is already on the base commit is never changed or removed"]


def test_only_the_first_baseline_is_exempt():
    later = "supabase/migrations/20261201000000_baseline.sql"
    problems, checked = lint_changes([("A", later)], {BASELINE: BASELINE_SQL}, {later: "DROP TABLE public.users;"})
    assert checked == [later] and len(problems) == 1 and NOT_ADDITIVE in problems[0]


def test_a_migration_added_with_the_baseline_is_checked_against_it():
    problems, checked = lint_changes(
        [("A", BASELINE), ("A", NEW)],
        {},
        {BASELINE: BASELINE_SQL, NEW: "CREATE TABLE IF NOT EXISTS users (id uuid);"},
    )
    assert checked == [NEW] and len(problems) == 1 and EXISTS in problems[0]


def test_without_a_baseline_no_migration_passes():
    problems, checked = lint_changes([("A", NEW)], {}, {NEW: "COMMENT ON TABLE public.users IS 'x';"})
    assert checked == []
    assert problems == [f"{NEW}: there is no baseline migration yet, so this check cannot tell what exists"]


@pytest.mark.parametrize(
    "path",
    [
        "supabase/migrations/add_notes.sql",
        "supabase/migrations/20261201000000_add_notes.SQL",
        "supabase/migrations/old/20261201000000_add_notes.sql",
        "supabase/migrations/README.md",
    ],
)
def test_migration_files_must_be_named_as_the_supabase_cli_expects(path):
    problems, checked = lint_changes([("A", path)], {BASELINE: BASELINE_SQL}, {path: "COMMENT ON TABLE users IS 'x';"})
    assert checked == [] and len(problems) == 1 and "name migration files" in problems[0]


EXISTING = BASELINE_SQL + """
CREATE OR REPLACE VIEW public.board AS SELECT 1;
CREATE SEQUENCE IF NOT EXISTS public.counter;
CREATE UNLOGGED TABLE public.cache (k text);
CREATE MATERIALIZED VIEW public.totals AS SELECT 1;
ALTER TABLE IF EXISTS public.roadmaps RENAME TO plans;
ALTER FUNCTION public.refresh_user_streak(uuid) RENAME TO refresh_streak;
"""


@pytest.mark.parametrize(
    "sql",
    [
        "CREATE TABLE IF NOT EXISTS board (id int);",
        "CREATE TABLE IF NOT EXISTS counter (id int);",
        "CREATE TABLE IF NOT EXISTS cache (id int);",
        "CREATE TABLE IF NOT EXISTS totals (id int);",
        "CREATE TABLE IF NOT EXISTS plans (id int);",
        "CREATE FUNCTION refresh_streak() RETURNS void LANGUAGE sql AS 'SELECT 1';",
    ],
)
def test_views_sequences_and_renamed_objects_count_as_existing(sql):
    problems, _ = lint_changes([("A", NEW)], {BASELINE: EXISTING}, {NEW: sql})
    assert len(problems) == 1 and EXISTS in problems[0]


def test_an_unreadable_migration_on_the_base_commit_fails_rather_than_guessing():
    problems, _ = lint_changes([("A", NEW)], {BASELINE: BASELINE_SQL + "SELECT $$"}, {NEW: "COMMENT ON TABLE t IS 'x';"})
    assert problems[0].startswith(f"{BASELINE}: cannot tell what this migration creates")


# Against a real git repository


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()


def commit(repo, files):
    """Write the files (text as UTF-8, bytes as they are, None deletes one), commit them
    and return the commit."""
    for path, text in files.items():
        target = repo / path
        if text is None:
            target.unlink()
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(text, bytes):
            target.write_bytes(text)
        else:
            target.write_text(text, encoding="utf-8", newline="\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "change")
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def repo(tmp_path, monkeypatch):
    """An empty repository; git ignores the user's and the system's configuration."""
    config = tmp_path / "gitconfig"
    config.write_text("")
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", str(config))
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    for variable in ("GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"):
        monkeypatch.setenv(variable, "test")
    path = tmp_path / "repo"
    path.mkdir()
    git(path, "init", "-q", "-b", "master")
    return path


def test_git_only_what_the_branch_adds_is_checked(repo, capsys):
    base = commit(repo, {BASELINE: BASELINE_SQL})
    git(repo, "switch", "-q", "-c", "feature")
    commit(repo, {"README.md": "no migration here"})
    assert run(base, repo) == 0
    assert "Checked 0 added migration file(s)" in capsys.readouterr().out

    commit(repo, {NEW: "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;"})
    assert run(base, repo) == 0
    output = capsys.readouterr().out
    assert "Checked 1 added migration file(s)" in output and output.endswith(f"\n  checked {NEW}\n")

    # master gains a migration the branch does not have; that is not a removal.
    git(repo, "switch", "-q", "master")
    master = commit(repo, {"supabase/migrations/20261130000000_comment.sql": "COMMENT ON TABLE users IS 'x';"})
    git(repo, "switch", "-q", "feature")
    assert run(master, repo) == 0
    output = capsys.readouterr().out
    assert "Checked 1 added migration file(s)" in output and output.endswith(f"\n  checked {NEW}\n")

    commit(repo, {"supabase/migrations/20261202000000_drop.sql": "-- tidy up\nDROP TABLE public.users;\n"})
    assert run(master, repo) == 1
    output = capsys.readouterr().out
    assert "20261202000000_drop.sql, line 2: not one of the additive forms\n    DROP TABLE public.users" in output
    assert "1 problem(s)" in output


def test_git_editing_or_renaming_a_migration_fails(repo, capsys):
    # A migration the owner applied by hand, which would not pass if it were new.
    old = "supabase/migrations/20261125000000_rename_streaks.sql"
    base = commit(repo, {BASELINE: BASELINE_SQL, old: "ALTER TABLE challenges RENAME TO streaks;\n"})
    git(repo, "switch", "-q", "-c", "edit")
    commit(repo, {old: "ALTER TABLE challenges RENAME TO streak_log;\n"})
    assert run(base, repo) == 1
    output = capsys.readouterr().out
    assert f"{old}: a migration that is already on the base commit is never changed or removed" in output
    assert "1 problem(s)" in output

    # A rename is a removal plus an addition, and the added file is checked too.
    git(repo, "switch", "-q", "-c", "rename", base)
    git(repo, "mv", old, "supabase/migrations/20261126000000_rename_streaks.sql")
    git(repo, "commit", "-q", "-m", "rename")
    assert run(base, repo) == 1
    output = capsys.readouterr().out
    assert f"{old}: a migration that is already on the base commit is never changed or removed" in output
    assert "20261126000000_rename_streaks.sql, line 1: ALTER TABLE accepts only" in output
    assert "2 problem(s)" in output


@pytest.mark.parametrize("sql, problem", HIDDEN)
def test_git_text_postgres_runs_is_found_in_the_bytes_of_the_file(repo, capsys, sql, problem):
    base = commit(repo, {BASELINE: BASELINE_SQL})
    commit(repo, {NEW: sql.encode("utf-8")})
    blob = subprocess.run(["git", "cat-file", "blob", f"HEAD:{NEW}"], cwd=repo, check=True, capture_output=True)
    assert blob.stdout == sql.encode("utf-8")
    assert run(base, repo) == 1
    assert problem in capsys.readouterr().out


def test_git_an_unknown_base_is_an_error(repo, capsys):
    commit(repo, {"README.md": "x"})
    assert run("no-such-commit", repo) == 2
    assert "git failed" in capsys.readouterr().err
