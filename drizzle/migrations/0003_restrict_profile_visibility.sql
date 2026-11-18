CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Members always see their own profile.
    _profile_id = auth.uid()
    -- Anyone can see the name of someone currently lending an item.
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.owner_id = _profile_id AND l.available)
    -- Signed-in members can see people they share a conversation with.
    OR (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.participant_a = auth.uid() AND c.participant_b = _profile_id)
         OR (c.participant_b = auth.uid() AND c.participant_a = _profile_id)
    ))
    -- Signed-in members can see the other side of their rentals.
    OR (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.rentals r
      WHERE (r.borrower_id = auth.uid() AND r.owner_id = _profile_id)
         OR (r.owner_id = auth.uid() AND r.borrower_id = _profile_id)
    ))
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles visible to self, lenders, and counterparts"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (public.can_view_profile(id));