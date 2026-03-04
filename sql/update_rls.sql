-- Drop the overly restrictive policies
DROP POLICY IF EXISTS "rooms: select member" ON public.rooms;
DROP POLICY IF EXISTS "rooms: update join" ON public.rooms;

-- Allow anyone authenticated to SELECT rooms
-- Necessary so they can find the room to join it
CREATE POLICY "rooms: select any"
  ON public.rooms FOR SELECT
  USING (true);

-- Allow anyone to UPDATE a room to join it
CREATE POLICY "rooms: update member"
  ON public.rooms FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = partner_id
    OR partner_id IS NULL -- so new user can join
    OR public.is_admin()
  );
