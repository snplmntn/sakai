-- Create the community_submissions table
CREATE TABLE IF NOT EXISTS public.community_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    submission_type text NOT NULL CHECK (submission_type IN ('missing_route', 'route_correction', 'fare_update', 'route_note')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
    title text NOT NULL,
    payload jsonb NOT NULL,
    source_context jsonb,
    review_notes text,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Add a trigger to automatically update the updated_at timestamp
CREATE TRIGGER set_community_submissions_updated_at
BEFORE UPDATE ON public.community_submissions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;

-- Grant permissions to the authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_submissions TO authenticated;

-- Create policies for RLS
CREATE POLICY "Allow users to view their own submissions"
ON public.community_submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to create submissions"
ON public.community_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own pending submissions"
ON public.community_submissions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id);
