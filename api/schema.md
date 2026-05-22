-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.problem_completions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  roadmap_id bigint NOT NULL,
  problem_id bigint NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  task_id bigint NOT NULL,
  topic_name text NOT NULL,
  CONSTRAINT problem_completions_pkey PRIMARY KEY (id),
  CONSTRAINT problem_completions_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id),
  CONSTRAINT problem_completions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT problem_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.progress (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  roadmap_id bigint NOT NULL,
  task_id bigint,
  completed json,
  user_id uuid NOT NULL,
  completion_percentage smallint,
  positive_feedback text,
  negative_feedback text,
  total_problem_count integer NOT NULL,
  completed_problem_count integer NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT progress_pkey PRIMARY KEY (id),
  CONSTRAINT progress_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id),
  CONSTRAINT progress_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT progress_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.roadmaps (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  roadmap_data ARRAY NOT NULL,
  company text,
  user_input json NOT NULL,
  CONSTRAINT roadmaps_pkey PRIMARY KEY (id),
  CONSTRAINT roadmaps_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tasks (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  roadmap_id bigint NOT NULL,
  lc_problem_ids ARRAY,
  week smallint,
  other_topics ARRAY,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT problems_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id)
);
CREATE TABLE public.topic_completions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  roadmap_id bigint NOT NULL,
  task_id bigint NOT NULL,
  topic_name text NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT topic_completions_pkey PRIMARY KEY (id),
  CONSTRAINT topic_completions_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id),
  CONSTRAINT topic_completions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT topic_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_streaks (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deadline date,
  current_knowledge json,
  weekly_hours smallint DEFAULT '10'::smallint,
  goal text,
  weeks smallint DEFAULT '1'::smallint,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

---
Indexes:

CREATE INDEX IF NOT EXISTS idx_pc_user_id
  ON public.problem_completions (user_id);
CREATE INDEX IF NOT EXISTS idx_pc_user_completed_at
  ON public.problem_completions (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pc_task_id
  ON public.problem_completions (task_id);

CREATE INDEX IF NOT EXISTS idx_tc_user_id
  ON public.topic_completions (user_id);




---
6. Helper function: recalculate & cache streaks for a user
--    Call this from your API after each completion insert/delete.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_user_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current  integer := 0;
  v_longest  integer := 0;
  v_last     date;
  v_streak   integer := 0;
  v_prev     date;
  rec        record;
BEGIN
  -- Get distinct active days (UTC) ordered descending
  FOR rec IN
    SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
    FROM public.problem_completions
    WHERE user_id = p_user_id
    UNION
    SELECT DISTINCT (completed_at AT TIME ZONE 'UTC')::date AS d
    FROM public.topic_completions
    WHERE user_id = p_user_id
    ORDER BY d DESC
  LOOP
    IF v_prev IS NULL THEN
      -- first day
      v_streak := 1;
      v_last   := rec.d;
    ELSIF v_prev - rec.d = 1 THEN
      -- consecutive day
      v_streak := v_streak + 1;
    ELSE
      -- gap: save longest so far and reset
      IF v_streak > v_longest THEN
        v_longest := v_streak;
      END IF;
      v_streak := 1;
    END IF;
    v_prev := rec.d;
  END LOOP;

  -- final check
  IF v_streak > v_longest THEN
    v_longest := v_streak;
  END IF;

  -- current streak only counts if last activity was today or yesterday
  IF v_last IS NOT NULL AND (CURRENT_DATE - v_last) <= 1 THEN
    v_current := v_streak;
  ELSE
    v_current := 0;
  END IF;

  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
  VALUES (p_user_id, v_current, v_longest, v_last, now())
  ON CONFLICT (user_id) DO UPDATE
    SET current_streak    = EXCLUDED.current_streak,
        longest_streak    = EXCLUDED.longest_streak,
        last_activity_date = EXCLUDED.last_activity_date,
        updated_at        = EXCLUDED.updated_at;
END;
$$;

---
# If any changes to be made/migrations to be applied add them below this point so that they can be run in the supabase UI to update the DB.

-- ============================================================================
-- Migration: roadmap-level AI feedback storage
-- Adds a dedicated table so roadmap-wide coaching feedback can be cached and
-- re-read without regenerating. One row per generation (history is kept).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roadmap_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  roadmap_id bigint NOT NULL,
  summary text,
  positive_feedback text,
  negative_feedback text,
  focus_areas jsonb DEFAULT '[]'::jsonb,
  completion_percentage smallint,
  pace_status text,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roadmap_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT roadmap_feedback_roadmap_id_fkey
    FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  CONSTRAINT roadmap_feedback_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rf_roadmap_generated_at
  ON public.roadmap_feedback (roadmap_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rf_user_id
  ON public.roadmap_feedback (user_id);

-- ============================================================================
-- Migration: backfill problem_completions / topic_completions from historical
-- `progress.completed` JSON so existing users surface in analytics. Safe to
-- re-run (ON CONFLICT-free; uses NOT EXISTS guards). For very large datasets
-- prefer `python -m scripts.backfill_completions` from `api/` which also
-- derives `topic_name` from the LeetCode dataset instead of 'General'.
-- ============================================================================
INSERT INTO public.problem_completions
  (user_id, roadmap_id, task_id, problem_id, topic_name, completed_at)
SELECT
  p.user_id,
  p.roadmap_id,
  p.task_id,
  (kv.key)::bigint AS problem_id,
  'General'        AS topic_name,
  COALESCE(p.updated_at, p.created_at) AS completed_at
FROM public.progress p
CROSS JOIN LATERAL json_each_text((p.completed -> 'problems')) AS kv(key, value)
WHERE p.task_id IS NOT NULL
  AND p.completed IS NOT NULL
  AND kv.value::boolean = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.problem_completions pc
    WHERE pc.user_id = p.user_id
      AND pc.task_id = p.task_id
      AND pc.problem_id = (kv.key)::bigint
  );

INSERT INTO public.topic_completions
  (user_id, roadmap_id, task_id, topic_name, completed_at)
SELECT
  p.user_id,
  p.roadmap_id,
  p.task_id,
  kv.key AS topic_name,
  COALESCE(p.updated_at, p.created_at) AS completed_at
FROM public.progress p
CROSS JOIN LATERAL json_each_text((p.completed -> 'topics')) AS kv(key, value)
WHERE p.task_id IS NOT NULL
  AND p.completed IS NOT NULL
  AND kv.value::boolean = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.topic_completions tc
    WHERE tc.user_id = p.user_id
      AND tc.task_id = p.task_id
      AND tc.topic_name = kv.key
  );

-- Refresh cached streaks for every user touched by the backfill.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.progress WHERE user_id IS NOT NULL LOOP
    PERFORM public.refresh_user_streak(r.user_id);
  END LOOP;
END $$;

-- ============================================================================
-- Migration: challenges + leaderboard support
-- ----------------------------------------------------------------------------
-- 1. `challenges` — persisted timed problem-set sessions, generated from a
--    user's roadmap weak topics (or ad-hoc). One row per session.
-- 2. Relax `problem_completions.roadmap_id/task_id` to NULLABLE and add a
--    `source` column so challenge solves can be mirrored into analytics
--    without a backing task. Existing rows are unaffected.
-- 3. `users.display_name` — optional public handle for the leaderboard.
-- 4. `get_leaderboard(period, limit)` — SECURITY DEFINER RPC that aggregates
--    difficulty-weighted problem solves + challenge scores per user and joins
--    a display name (users.display_name -> auth metadata -> email local-part).
-- All statements are idempotent / additive and safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.challenges (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  roadmap_id bigint,
  title text NOT NULL,
  problem_ids bigint[] NOT NULL,
  focus_topics text[] DEFAULT '{}'::text[],
  difficulty text NOT NULL DEFAULT 'mixed',
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active',
  solved_problem_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  score integer,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT challenges_pkey PRIMARY KEY (id),
  CONSTRAINT challenges_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT challenges_roadmap_id_fkey
    FOREIGN KEY (roadmap_id) REFERENCES public.roadmaps(id) ON DELETE SET NULL,
  CONSTRAINT challenges_status_check
    CHECK (status IN ('active', 'completed', 'abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_challenges_user_created
  ON public.challenges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_user_status
  ON public.challenges (user_id, status);
CREATE INDEX IF NOT EXISTS idx_challenges_completed_at
  ON public.challenges (completed_at DESC) WHERE status = 'completed';

-- Allow challenge-sourced completions (no roadmap/task context) and tag origin.
ALTER TABLE public.problem_completions
  ALTER COLUMN roadmap_id DROP NOT NULL,
  ALTER COLUMN task_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'roadmap';

-- Optional public handle for the leaderboard. Nullable; falls back to auth
-- metadata / email local-part inside get_leaderboard().
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name text;

-- ----------------------------------------------------------------------------
-- Leaderboard aggregation. Period: 'week' (7d), 'month' (30d) or 'all'.
-- Points = Easy×10 + Medium×25 + Hard×50 (distinct problems in window)
--        + SUM(challenge.score) for challenges completed in window.
-- SECURITY DEFINER so it can read auth.users for display names while still
-- being callable with the anon key.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_period text DEFAULT 'week',
  p_limit  integer DEFAULT 100
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  problems_solved bigint,
  challenge_points bigint,
  points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  v_since := CASE lower(coalesce(p_period, 'week'))
    WHEN 'week'  THEN now() - interval '7 days'
    WHEN 'month' THEN now() - interval '30 days'
    ELSE 'epoch'::timestamptz
  END;

  RETURN QUERY
  WITH solves AS (
    SELECT DISTINCT pc.user_id, pc.problem_id
    FROM public.problem_completions pc
    WHERE pc.completed_at >= v_since
  ),
  -- Difficulty isn't stored on the row; weight everything as Medium for now.
  -- Challenge scores already encode difficulty so the blend stays meaningful.
  solve_points AS (
    SELECT s.user_id,
           count(*)::bigint AS problems_solved,
           (count(*) * 25)::bigint AS pts
    FROM solves s
    GROUP BY s.user_id
  ),
  challenge_points AS (
    SELECT c.user_id,
           coalesce(sum(c.score), 0)::bigint AS pts
    FROM public.challenges c
    WHERE c.status = 'completed'
      AND c.completed_at >= v_since
    GROUP BY c.user_id
  ),
  merged AS (
    SELECT
      coalesce(sp.user_id, cp.user_id) AS user_id,
      coalesce(sp.problems_solved, 0)  AS problems_solved,
      coalesce(cp.pts, 0)              AS challenge_points,
      coalesce(sp.pts, 0) + coalesce(cp.pts, 0) AS points
    FROM solve_points sp
    FULL OUTER JOIN challenge_points cp ON cp.user_id = sp.user_id
  )
  SELECT
    m.user_id,
    coalesce(
      pu.display_name,
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      split_part(au.email, '@', 1),
      'Anonymous'
    ) AS display_name,
    m.problems_solved,
    m.challenge_points,
    m.points
  FROM merged m
  LEFT JOIN public.users pu ON pu.id = m.user_id
  LEFT JOIN auth.users au ON au.id = m.user_id
  WHERE m.points > 0
  ORDER BY m.points DESC, m.problems_solved DESC
  LIMIT greatest(1, least(p_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO anon, authenticated, service_role;

-- ============================================================================
-- AI Mock Interviewer
-- ----------------------------------------------------------------------------
-- Persists each voice interview session: the context snapshot fed to the
-- Gemini Live system prompt, the rolling transcript, and the post-hoc rubric
-- scoring + structured feedback. `created_at` is included (in addition to
-- `started_at`) so list/stats endpoints can ORDER BY a stable column even if a
-- session is back-dated. Idempotent / additive.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  roadmap_id bigint REFERENCES public.roadmaps(id) ON DELETE SET NULL,
  interview_type text NOT NULL DEFAULT 'technical',
  difficulty text NOT NULL DEFAULT 'intermediate',
  duration_minutes int NOT NULL DEFAULT 45,
  status text NOT NULL DEFAULT 'active',
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  problem_ids bigint[] NOT NULL DEFAULT '{}',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  rubric_scores jsonb,
  overall_score int,
  feedback jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT interview_sessions_status_check
    CHECK (status IN ('active','completed','abandoned'))
);

CREATE INDEX IF NOT EXISTS idx_is_user_created
  ON public.interview_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_is_user_status
  ON public.interview_sessions (user_id, status);
