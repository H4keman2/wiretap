CREATE TABLE public.waiver_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'ppr',
  roster JSONB NOT NULL DEFAULT '[]'::jsonb,
  candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waiver_questions TO authenticated;
GRANT ALL ON public.waiver_questions TO service_role;

ALTER TABLE public.waiver_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own waiver questions"
  ON public.waiver_questions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own waiver questions"
  ON public.waiver_questions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own waiver questions"
  ON public.waiver_questions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX waiver_questions_user_created_idx ON public.waiver_questions (user_id, created_at DESC);