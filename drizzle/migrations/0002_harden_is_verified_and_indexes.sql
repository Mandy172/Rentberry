REVOKE EXECUTE ON FUNCTION public.is_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified(uuid) TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS conversations_listing_idx ON public.conversations(listing_id);
CREATE INDEX IF NOT EXISTS favorites_listing_idx ON public.favorites(listing_id);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages(sender_id);