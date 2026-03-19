CREATE TABLE IF NOT EXISTS public.community_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    title text NOT NULL,
    body text NOT NULL,
    origin_label text NOT NULL,
    destination_label text NOT NULL,
    origin_place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
    destination_place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
    route_query_text text,
    preference text CHECK (preference IN ('fastest', 'cheapest', 'balanced')),
    passenger_type text CHECK (passenger_type IN ('regular', 'student', 'senior', 'pwd')),
    source_context jsonb,
    reply_count integer NOT NULL DEFAULT 0,
    last_answered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.community_question_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES public.community_questions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER set_community_questions_updated_at
BEFORE UPDATE ON public.community_questions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_community_question_answers_updated_at
BEFORE UPDATE ON public.community_question_answers
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_community_question_reply_count(question_id_input uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.community_questions
  SET reply_count = reply_count + 1,
      last_answered_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = question_id_input;
$$;

ALTER TABLE public.community_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_question_answers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.community_questions TO authenticated;
GRANT SELECT, INSERT ON public.community_question_answers TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_community_question_reply_count(uuid) TO authenticated;

CREATE POLICY "Allow authenticated users to view community questions"
ON public.community_questions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow users to create community questions"
ON public.community_questions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to view question answers"
ON public.community_question_answers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow users to create answers"
ON public.community_question_answers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
