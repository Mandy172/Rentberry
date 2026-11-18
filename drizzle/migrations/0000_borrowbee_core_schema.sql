
-- Profiles (public display info). No FK to auth.users so sample owners can exist.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT TO anon, authenticated USING (true);

-- Private member data
CREATE TABLE public.member_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE,
  verified_at timestamptz,
  selfie_hash text,
  stripe_account_id text,
  stripe_connected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_private TO authenticated;
GRANT ALL ON public.member_private TO service_role;
ALTER TABLE public.member_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own private data" ON public.member_private FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_verified(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.member_private WHERE user_id = _uid AND verified_at IS NOT NULL)
$$;

-- OTP challenges (server only)
CREATE TABLE public.otp_challenges (
  phone text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.otp_challenges TO service_role;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;

-- Listings
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  category text NOT NULL CHECK (category IN ('tools','event','outdoor','electronics','books','other')),
  condition text NOT NULL DEFAULT 'Good' CHECK (condition IN ('New','Like new','Good','Fair')),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
  hourly_rate numeric CHECK (hourly_rate IS NULL OR hourly_rate BETWEEN 0 AND 1000000),
  daily_rate numeric CHECK (daily_rate IS NULL OR daily_rate BETWEEN 0 AND 1000000),
  flat_rate numeric CHECK (flat_rate IS NULL OR flat_rate BETWEEN 0 AND 1000000),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 99),
  deposit numeric NOT NULL DEFAULT 0 CHECK (deposit BETWEEN 0 AND 1000000),
  available boolean NOT NULL DEFAULT true,
  rules text[] NOT NULL DEFAULT '{}' CHECK (cardinality(rules) <= 20),
  agreement_template text NOT NULL DEFAULT 'standard' CHECK (agreement_template IN ('standard','event','electronics')),
  media jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(media) = 'array' AND jsonb_array_length(media) <= 10),
  location text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (coalesce(hourly_rate,0) > 0 OR coalesce(daily_rate,0) > 0 OR coalesce(flat_rate,0) > 0)
);
CREATE INDEX listings_owner_idx ON public.listings(owner_id);
CREATE INDEX listings_created_idx ON public.listings(created_at DESC);
GRANT SELECT ON public.listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Available listings are public" ON public.listings FOR SELECT TO anon, authenticated USING (available OR owner_id = auth.uid());
CREATE POLICY "Verified members create own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_verified(auth.uid()));
CREATE POLICY "Owners update own listings" ON public.listings FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND public.is_verified(auth.uid())) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own listings" ON public.listings FOR DELETE TO authenticated USING (owner_id = auth.uid() AND public.is_verified(auth.uid()));

-- Drafts
CREATE TABLE public.listing_drafts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_drafts TO authenticated;
GRANT ALL ON public.listing_drafts TO service_role;
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own draft read" ON public.listing_drafts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own draft insert" ON public.listing_drafts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_verified(auth.uid()));
CREATE POLICY "Own draft update" ON public.listing_drafts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own draft delete" ON public.listing_drafts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Favorites
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites read" ON public.favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own favorites insert" ON public.favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_verified(auth.uid()));
CREATE POLICY "Own favorites delete" ON public.favorites FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Rentals
CREATE TABLE public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  listing_title text NOT NULL,
  borrower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days int NOT NULL CHECK (days BETWEEN 1 AND 60),
  quantity int NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  subtotal numeric NOT NULL,
  fee numeric NOT NULL,
  deposit numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','completed')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rentals_listing_idx ON public.rentals(listing_id);
CREATE INDEX rentals_borrower_idx ON public.rentals(borrower_id);
CREATE INDEX rentals_owner_idx ON public.rentals(owner_id);
GRANT SELECT ON public.rentals TO authenticated;
GRANT ALL ON public.rentals TO service_role;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read rentals" ON public.rentals FOR SELECT TO authenticated USING (borrower_id = auth.uid() OR owner_id = auth.uid());

-- Conversations
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  listing_title text NOT NULL,
  participant_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_a_idx ON public.conversations(participant_a);
CREATE INDEX conversations_b_idx ON public.conversations(participant_b);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT TO authenticated USING (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid()))
);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Seed: original sample owners and listings
INSERT INTO public.profiles (id, display_name, created_at) VALUES
  ('00000000-0000-4000-8000-00000000a001', 'Kiran O.', now() - interval '90 days'),
  ('00000000-0000-4000-8000-00000000a002', 'Jay M.', now() - interval '60 days');

INSERT INTO public.listings (id, owner_id, title, category, condition, description, tags, hourly_rate, daily_rate, flat_rate, quantity, deposit, available, rules, agreement_template, media, location, created_at) VALUES
('00000000-0000-4000-8000-0000000b0001','00000000-0000-4000-8000-00000000a001','White Rolling Standing Cooler | Event & Party Drinks Station','event','Good','Rolling patio cooler with a built-in bottle opener and side shelf. Holds about 70 cans with ice. Perfect for club events, fest stalls and hostel nights.',ARRAY['cooler','fest','party'],NULL,900,NULL,1,1500,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'event','[{"url":"/__l5e/assets-v1/1e6cf526-b592-4550-bfb4-f4bea1cfb7ec/rolling-cooler.jpg","type":"image"}]','Boys Hostel, Block A', now() - interval '1 day'),
('00000000-0000-4000-8000-0000000b0002','00000000-0000-4000-8000-00000000a001','White Display Cart | Candy, Dessert, Favors Stall','event','Good','Wooden display cart with a scalloped canopy and two shelves. Great for bake sales, cultural fest stalls and department open days. Jars included.',ARRAY['stall','display','fest'],NULL,800,NULL,1,2000,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'event','[{"url":"/__l5e/assets-v1/c34002f3-f83d-4775-8736-c0507ee413e0/display-cart.jpg","type":"image"}]','Food Court', now() - interval '2 days'),
('00000000-0000-4000-8000-0000000b0003','00000000-0000-4000-8000-00000000a002','Drone 4K Mini','electronics','Good','Compact 4K camera drone with controller, three batteries and a carry case. Ideal for project shoots, sports day aerials and short films. Follow campus drone rules.',ARRAY['drone','video','photography'],120,550,NULL,1,5000,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'electronics','[{"url":"/__l5e/assets-v1/be8b89f9-087d-4ac0-91db-f4df25ce58a6/drone.jpg","type":"image"}]','Engineering Block', now() - interval '3 days'),
('00000000-0000-4000-8000-0000000b0004','00000000-0000-4000-8000-00000000a002','Hot Box','event','Good','Insulated stainless steel food warming cabinet on wheels. Keeps trays hot for hours, useful for department lunches and event catering.',ARRAY['catering','food warmer'],NULL,1500,NULL,1,3000,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'event','[{"url":"/__l5e/assets-v1/17d7d98c-f6b8-4558-8f60-83c3158cdf79/hot-box.jpg","type":"image"}]','Food Court', now() - interval '4 days'),
('00000000-0000-4000-8000-0000000b0005','00000000-0000-4000-8000-00000000a002','Evaporative Cooler','event','Good','Large portable air cooler for halls, stalls and outdoor events. Covers roughly 800 sq ft. Fill with water and plug in.',ARRAY['cooling','summer'],NULL,1200,NULL,1,2500,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'event','[{"url":"/__l5e/assets-v1/98f42767-2085-4bd8-bf93-21e96726d401/evaporative-cooler.jpg","type":"image"}]','Auditorium Lobby', now() - interval '5 days'),
('00000000-0000-4000-8000-0000000b0006','00000000-0000-4000-8000-00000000a002','Patio Heater','outdoor','Good','Tall stainless steel patio heater for winter evening events and outdoor gatherings. Gas cylinder not included.',ARRAY['heater','winter','outdoor'],NULL,1000,NULL,1,2000,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'standard','[{"url":"/__l5e/assets-v1/7e308ee2-4ba7-4bce-8261-ca93969bf392/patio-heater.jpg","type":"image"}]','Sports Complex', now() - interval '6 days'),
('00000000-0000-4000-8000-0000000b0007','00000000-0000-4000-8000-00000000a002','Pressure Washer','tools','Good','Petrol pressure washer with a 25 ft hose and three nozzles. Great for cleaning bikes, cars and club equipment before a big event.',ARRAY['cleaning','tools'],100,450,NULL,1,1500,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'standard','[{"url":"/__l5e/assets-v1/13d0c50d-8eb5-4d24-b1ac-1d54278578d3/pressure-washer.jpg","type":"image"}]','Main Gate', now() - interval '7 days'),
('00000000-0000-4000-8000-0000000b0008','00000000-0000-4000-8000-00000000a001','White Bounce House','event','Good','Inflatable white bounce house with sheer curtains and a blower. A crowd favourite for fest fun zones and faculty family days.',ARRAY['inflatable','fest','kids'],NULL,2500,NULL,1,4000,true,ARRAY['Return clean and on time','No subletting','Report any damage right away'],'event','[{"url":"/__l5e/assets-v1/59294821-8d3d-4575-928d-e802eff7fd78/bounce-house.jpg","type":"image"}]','Sports Complex', now() - interval '8 days');
