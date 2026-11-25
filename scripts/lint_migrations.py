"""Fail unless the migrations a change adds only add to the database.

Production has no backups, so a migration that drops, renames or rewrites something
cannot be undone. This reads each file HEAD adds under supabase/migrations/, compared
with a base commit (default origin/master), and accepts only: CREATE TABLE IF NOT
EXISTS <name> (...) and CREATE [OR REPLACE] FUNCTION, for names that do not exist yet;
CREATE INDEX IF NOT EXISTS; ALTER TABLE ... ADD COLUMN IF NOT EXISTS, nullable or with
a default; ENABLE ROW LEVEL SECURITY, CREATE POLICY and GRANT, on a table or function
created earlier in the same file; COMMENT ON. Any other statement fails and is quoted,
as do objects outside the public schema, edits to or removals of a migration already
on the base commit, and file names the Supabase CLI would skip. What exists is read
from the migrations on the base commit, so nothing passes before the baseline,
<version>_baseline.sql, which is exempt: it builds the production schema for local
and CI databases and is never applied to production.

Usage, from the repository root: python scripts/lint_migrations.py [<base commit>]
"""

import itertools
import re
import subprocess
import sys
from collections import namedtuple
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = "supabase/migrations/"
MIGRATION_FILE = re.compile(r"supabase/migrations/\d+_[^/]+\.sql")
BASELINE_FILE = re.compile(r"supabase/migrations/\d+_baseline\.sql")

_TOKEN = re.compile(
    r"(?P<space>\s+)"
    r"|(?P<comment>--[^\n]*)"
    r"|(?P<block>/\*)"
    r"|(?P<string>[eE]'(?:[^'\\]|\\.|'')*'|'(?:[^']|'')*')"
    r'|(?P<name>"(?:[^"]|"")*")'
    r"|(?P<unclosed>[eE]?'|\")"
    r"|(?P<dollar>\$(?:[^\W\d]\w*)?\$)"
    r"|(?P<word>[^\W\d][\w$]*)"
    r"|(?P<punct>\$\d+|\d+|.)",
    re.DOTALL,
)
_BLOCK_EDGE = re.compile(r"/\*|\*/")
_NAMES = ("word", "name")
_CREATED = {"table", "view", "sequence", "function"}
_MODIFIERS = {"temp", "temporary", "unlogged", "global", "local", "foreign", "materialized", "recursive"}


class LintError(Exception):
    """The SQL could not be split into statements."""


# kind is word (lower-cased), name (a quoted identifier), string, body (dollar-quoted) or punct.
Tok = namedtuple("Tok", "kind value")
Statement = namedtuple("Statement", "tokens text line")
OPEN, CLOSE, COMMA, DOT = (Tok("punct", char) for char in "(),.")


@dataclass
class Objects:
    relations: set = field(default_factory=set)  # tables, views and sequences, as (schema, name)
    functions: set = field(default_factory=set)


def _line(sql: str, pos: int) -> int:
    return sql.count("\n", 0, pos) + 1


def split_statements(sql: str) -> list[Statement]:
    """Split SQL at semicolons outside strings, quoted names, comments and dollar quotes."""
    sql += "\n;"  # ends a trailing line comment, then the last statement
    statements, tokens, start, end, pos = [], [], 0, 0, 0
    while pos < len(sql):
        match = _TOKEN.match(sql, pos)
        kind, text, after = match.lastgroup, match.group(), match.end()
        if kind == "unclosed":
            raise LintError(f"line {_line(sql, pos)}: a quoted string or name is never closed")
        if kind == "block":
            depth = 1
            while depth:
                edge = _BLOCK_EDGE.search(sql, after)
                if edge is None:
                    raise LintError(f"line {_line(sql, pos)}: a /* comment is never closed")
                depth, after = depth + (1 if edge.group() == "/*" else -1), edge.end()
        elif kind == "dollar":
            close = sql.find(text, after)
            if close < 0:
                raise LintError(f"line {_line(sql, pos)}: the {text} quote is never closed")
            kind, text, after = "body", sql[after:close], close + len(text)
        if kind == "punct" and text == ";":
            if tokens:
                statements.append(Statement(tokens, sql[start:end], _line(sql, start)))
            tokens = []
        elif kind not in ("space", "comment", "block"):
            if kind == "word":
                text = text.lower()
            elif kind == "name":
                text = text[1:-1].replace('""', '"')
            start = start if tokens else pos
            tokens.append(Tok(kind, text))
            end = after
        pos = after
    return statements


def _is(t: list, i: int, *words: str) -> bool:
    """True when t[i:] starts with these unquoted words."""
    return len(t) >= i + len(words) and all(tok == ("word", w) for tok, w in zip(t[i:], words))


def _skip(t: list, i: int, *phrases: tuple) -> int:
    """Move i past each of these optional phrases, in order."""
    for phrase in phrases:
        i += len(phrase) if _is(t, i, *phrase) else 0
    return i


def _depth0(t: list):
    """Yield (index, token) for the tokens outside parentheses and brackets."""
    depth = 0
    for i, tok in enumerate(t):
        if tok.kind == "punct" and tok.value in ("(", "["):
            depth += 1
        elif tok.kind == "punct" and tok.value in (")", "]"):
            depth -= 1
        elif depth == 0:
            yield i, tok


def _split(t: list) -> list:
    """Split tokens at the commas outside parentheses and brackets."""
    bounds = [-1, *(i for i, tok in _depth0(t) if tok == COMMA), len(t)]
    return [t[a + 1:b] for a, b in itertools.pairwise(bounds)]


def _name(t: list, i: int) -> tuple:
    """Read a name such as users, public.users or "public"."users" at t[i] and return
    ((schema, name) or None, the index after it). Unqualified names are in public."""
    parts = []
    while i < len(t) and t[i].kind in _NAMES and len(parts) < 3:
        parts.append(t[i].value)
        i += 1
        if t[i:i + 1] != [DOT]:
            break
        i += 1
    return (("public", *parts) if len(parts) == 1 else tuple(parts) if len(parts) == 2 else None), i


def _outside(name: tuple | None) -> str | None:
    if name is None:
        return "could not read the name"
    return None if name[0] == "public" else f"{name[0]}.{name[1]} is outside the public schema"


def record_objects(statements: list, objects: Objects) -> None:
    """Add the relations and functions that statements create or rename to."""
    for t in (st.tokens for st in statements):
        i = _skip(t, 1, ("or", "replace"))
        while i < len(t) and t[i].kind == "word" and t[i].value in _MODIFIERS:
            i += 1
        if not (_is(t, 0, "create") or _is(t, 0, "alter")) or i >= len(t) or t[i].value not in _CREATED:
            continue
        found = objects.functions if _is(t, i, "function") else objects.relations
        name, _ = _name(t, _skip(t, i + 1, ("if", "not", "exists"), ("if", "exists"), ("only",)))
        if name and t[0].value == "create":
            found.add(name)
        elif name:
            renamed = next((_name(t, j + 2)[0] for j, _ in _depth0(t) if _is(t, j, "rename", "to")), None)
            if renamed:
                found.add((name[0], renamed[1]))


def check_statement(t: list, known: Objects, new: Objects) -> str | None:
    """Return why a statement does not only add, or None when it does. known holds
    what existed before this file; new collects what this file creates."""
    if _is(t, 0, "comment", "on"):
        return None
    if _is(t, 0, "create", "table"):
        if not _is(t, 2, "if", "not", "exists"):
            return "CREATE TABLE must say IF NOT EXISTS"
        name, i = _name(t, 5)
        if t[i:i + 1] != [OPEN] or t[-1] != CLOSE or any(j > i for j, _ in _depth0(t)):
            return "only CREATE TABLE IF NOT EXISTS <name> (<columns and constraints>) is accepted"
        if _outside(name):
            return _outside(name)
        if name in known.relations or name in new.relations:
            return f"{name[0]}.{name[1]} already exists, so IF NOT EXISTS would skip it"
        new.relations.add(name)
        return None
    if _is(t, 0, "create", "index"):
        if not (_is(t, 2, "if", "not", "exists") and len(t) > 7 and t[5].kind in _NAMES and _is(t, 6, "on")):
            return "only CREATE INDEX IF NOT EXISTS <name> ON <table> is accepted"
        return _outside(_name(t, _skip(t, 7, ("only",)))[0])
    if _is(t, 0, "create", "function") or _is(t, 0, "create", "or", "replace", "function"):
        name, i = _name(t, 2 if _is(t, 1, "function") else 4)
        if _outside(name) or t[i:i + 1] != [OPEN]:
            return _outside(name) or "could not read the function name"
        if name in known.functions:
            return f"a function named {name[0]}.{name[1]} already exists"
        new.functions.add(name)
        return None
    if _is(t, 0, "alter", "table"):
        name, i = _name(t, _skip(t, 2, ("if", "exists"), ("only",)))
        if _outside(name):
            return _outside(name)
        for action in _split(t[i:]):
            if _is(action, 0, "add", "column", "if", "not", "exists") and len(action) > 6:
                top = [tok.value for _, tok in _depth0(action[6:]) if tok.kind == "word"]
                required = "primary" in top or ("not", "null") in itertools.pairwise(top)
                if required and "default" not in top and "generated" not in top:
                    return f"column {action[5].value} is NOT NULL and has no default"
            elif _is(action, 0, "enable", "row", "level", "security") and len(action) == 4:
                if name not in new.relations:
                    return "ENABLE ROW LEVEL SECURITY is accepted only for a table created in the same file"
            else:
                return "ALTER TABLE accepts only ADD COLUMN IF NOT EXISTS, and ENABLE ROW LEVEL SECURITY on a new table"
        return None
    if _is(t, 0, "create", "policy"):
        name = _name(t, 4)[0] if len(t) > 4 and t[2].kind in _NAMES and _is(t, 3, "on") else None
        return None if name in new.relations else "CREATE POLICY is accepted only for a table created in the same file"
    if _is(t, 0, "grant"):
        # GRANT <privileges> ON [TABLE | FUNCTION] <names> TO <roles>; ON ALL TABLES IN SCHEMA and the like fail.
        top = [j for j, _ in _depth0(t)]
        on = next((j for j in top if _is(t, j, "on")), len(t))
        to = next((j for j in top if j > on and _is(t, j, "to")), on)
        created = new.functions if _is(t, on + 1, "function") else new.relations
        for target in _split(t[_skip(t, on + 1, ("function",), ("table",)):to]):
            name, j = _name(target, 0)
            rest = target[j:]
            if created is new.functions and rest[:1] == [OPEN] and not any(_depth0(rest)):
                rest = []
            if name not in created or rest:
                return "GRANT is accepted only on a table or function created in the same file"
        return None
    return "not one of the additive forms"


def lint_changes(changes: list, base_files: dict, head_files: dict) -> tuple[list[str], int]:
    """Lint a change: (status, path) pairs from git diff --name-status, the SQL of each file
    on the base commit, and the SQL at HEAD of each added or modified file, all by path.
    Return the problems and the number of migration files checked."""
    problems, known, checked = [], Objects(), 0
    sources = {path: sql for path, sql in base_files.items() if MIGRATION_FILE.fullmatch(path)}
    added = sorted(path for status, path in changes if status == "A")
    baseline = next((path for path in [*sorted(sources), *added] if BASELINE_FILE.fullmatch(path)), None)
    if baseline in added:
        sources[baseline] = head_files[baseline]
    for path, sql in sorted(sources.items()):
        try:
            record_objects(split_statements(sql), known)
        except LintError as error:
            problems.append(f"{path}: cannot tell what this migration creates: {error}")
    for status, path in sorted(changes, key=lambda change: change[1]):
        if path == baseline and status in ("A", "M"):
            continue
        if status != "A":
            problems.append(f"{path}: a migration that is already on the base commit is never changed or removed")
        elif not MIGRATION_FILE.fullmatch(path):
            problems.append(f"{path}: name migration files <version>_<name>.sql, directly in {MIGRATIONS}")
        elif baseline is None:
            problems.append(f"{path}: there is no baseline migration yet, so this check cannot tell what exists")
        else:
            checked += 1
            try:
                statements = split_statements(head_files[path])
            except LintError as error:
                problems.append(f"{path}: {error}")
                continue
            new = Objects()
            for st in statements:
                reason = check_statement(st.tokens, known, new)
                if reason:
                    flat = " ".join(st.text.split())
                    quoted = flat if len(flat) <= 200 else flat[:200] + " ..."
                    problems.append(f"{path}, line {st.line}: {reason}\n    {quoted}")
            known.relations |= new.relations
            known.functions |= new.functions
    return problems, checked


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, check=True).stdout.decode("utf-8", "replace")


def run(base: str, repo: Path = REPO_ROOT) -> int:
    """Lint what HEAD changes under supabase/migrations/ since its merge base with base."""
    try:
        diff = _git(repo, "diff", "-z", "--name-status", "--no-renames", f"{base}...HEAD", "--", MIGRATIONS)
        changes = list(zip(diff.split("\0")[0:-1:2], diff.split("\0")[1::2]))
        listed = _git(repo, "ls-tree", "-r", "-z", "--name-only", base, "--", MIGRATIONS).split("\0")[:-1]
        base_files = {path: _git(repo, "show", f"{base}:{path}") for path in listed}
        head_files = {path: _git(repo, "show", f"HEAD:{path}") for status, path in changes if status in ("A", "M")}
    except subprocess.CalledProcessError as error:
        print(f"git failed: {error.stderr.decode('utf-8', 'replace').strip()}", file=sys.stderr)
        return 2
    problems, checked = lint_changes(changes, base_files, head_files)
    if problems:
        print("\n".join(problems))
        print(f"\n{len(problems)} problem(s). Only additive migrations pass: see scripts/lint_migrations.py.")
        return 1
    print(f"Checked {checked} added migration file(s) under {MIGRATIONS}: no problems. The baseline is exempt.")
    return 0


if __name__ == "__main__":
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else "origin/master"))
