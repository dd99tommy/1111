-- ============================================================
-- HeartSync Row Level Security Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: is_admin() function
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- USERS policies
-- ============================================================
DROP POLICY IF EXISTS "users: read own"        ON public.users;
DROP POLICY IF EXISTS "users: update own"      ON public.users;
DROP POLICY IF EXISTS "users: admin reads all" ON public.users;
DROP POLICY IF EXISTS "users: insert own"      ON public.users;

CREATE POLICY "users: insert own"
  ON public.users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users: read own"
  ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "users: update own"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins: unrestricted
CREATE POLICY "users: admin all"
  ON public.users FOR ALL
  USING (public.is_admin());

-- ============================================================
-- ROOMS policies
-- ============================================================
DROP POLICY IF EXISTS "rooms: member access"  ON public.rooms;
DROP POLICY IF EXISTS "rooms: insert own"     ON public.rooms;
DROP POLICY IF EXISTS "rooms: update own"     ON public.rooms;

-- Members can select rooms they created or joined
CREATE POLICY "rooms: select member"
  ON public.rooms FOR SELECT
  USING (
    auth.uid() = created_by
    OR auth.uid() = partner_id
    OR public.is_admin()
  );

-- Only creator can insert room
CREATE POLICY "rooms: insert own"
  ON public.rooms FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Room members or admin can update
CREATE POLICY "rooms: update member"
  ON public.rooms FOR UPDATE
  USING (
    auth.uid() = created_by
    OR auth.uid() = partner_id
    OR public.is_admin()
  );

-- Admin delete
CREATE POLICY "rooms: admin delete"
  ON public.rooms FOR DELETE
  USING (public.is_admin());

-- ============================================================
-- QUESTIONS policies
-- ============================================================
DROP POLICY IF EXISTS "questions: read active" ON public.questions;
DROP POLICY IF EXISTS "questions: admin all"   ON public.questions;

-- Authenticated users can read active questions
CREATE POLICY "questions: read active"
  ON public.questions FOR SELECT
  USING (active = TRUE OR public.is_admin());

-- Admins have full access
CREATE POLICY "questions: admin all"
  ON public.questions FOR ALL
  USING (public.is_admin());

-- ============================================================
-- ANSWERS policies
-- ============================================================
DROP POLICY IF EXISTS "answers: insert own"     ON public.answers;
DROP POLICY IF EXISTS "answers: read room"      ON public.answers;
DROP POLICY IF EXISTS "answers: admin all"      ON public.answers;

-- Users can insert their own answers in their rooms
CREATE POLICY "answers: insert own"
  ON public.answers FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
      AND (r.created_by = auth.uid() OR r.partner_id = auth.uid())
    )
  );

-- Users can read answers in completed rooms (both partners done) or their own answers always
CREATE POLICY "answers: read room"
  ON public.answers FOR SELECT
  USING (
    public.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_id
      AND (r.created_by = auth.uid() OR r.partner_id = auth.uid())
      AND r.status = 'completed'
    )
  );

-- Admin full access
CREATE POLICY "answers: admin all"
  ON public.answers FOR ALL
  USING (public.is_admin());
