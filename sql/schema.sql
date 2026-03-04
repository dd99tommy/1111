-- ============================================================
-- HeartSync Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  email       TEXT UNIQUE,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROOMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  compatibility_score NUMERIC(5,2),
  creator_done      BOOLEAN DEFAULT FALSE,
  partner_done      BOOLEAN DEFAULT FALSE,
  creator_message   TEXT,
  partner_message   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- ============================================================
-- QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('text', 'multiple_choice', 'scale')),
  options     JSONB,
  weight      INTEGER NOT NULL DEFAULT 1,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANSWERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.answers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_value  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_id, user_id, question_id)
);

-- ============================================================
-- FUNCTION: Auto-calculate compatibility score
-- Called after an answer is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION check_room_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_room          RECORD;
  v_creator_count INTEGER;
  v_partner_count INTEGER;
  v_question_count INTEGER;
  v_score         NUMERIC;
  v_total_weight  NUMERIC;
  v_earned_weight NUMERIC;
  q               RECORD;
  ans_creator     TEXT;
  ans_partner     TEXT;
  q_weight        INTEGER;
  q_type          TEXT;
  diff            NUMERIC;
BEGIN
  -- Get room info
  SELECT * INTO v_room FROM public.rooms WHERE id = NEW.room_id;
  
  IF v_room.partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count active questions
  SELECT COUNT(*) INTO v_question_count FROM public.questions WHERE active = TRUE;

  -- Count creator answers
  SELECT COUNT(*) INTO v_creator_count
  FROM public.answers
  WHERE room_id = NEW.room_id AND user_id = v_room.created_by;

  -- Count partner answers
  SELECT COUNT(*) INTO v_partner_count
  FROM public.answers
  WHERE room_id = NEW.room_id AND user_id = v_room.partner_id;

  -- Mark individual done flags
  IF NEW.user_id = v_room.created_by AND v_creator_count >= v_question_count THEN
    UPDATE public.rooms SET creator_done = TRUE WHERE id = NEW.room_id;
  END IF;

  IF NEW.user_id = v_room.partner_id AND v_partner_count >= v_question_count THEN
    UPDATE public.rooms SET partner_done = TRUE WHERE id = NEW.room_id;
  END IF;

  -- Both done → calculate score + mark completed
  IF v_creator_count >= v_question_count AND v_partner_count >= v_question_count THEN
    v_total_weight  := 0;
    v_earned_weight := 0;

    FOR q IN SELECT * FROM public.questions WHERE active = TRUE LOOP
      SELECT answer_value INTO ans_creator
      FROM public.answers
      WHERE room_id = NEW.room_id AND user_id = v_room.created_by AND question_id = q.id;

      SELECT answer_value INTO ans_partner
      FROM public.answers
      WHERE room_id = NEW.room_id AND user_id = v_room.partner_id AND question_id = q.id;

      q_weight := q.weight;
      q_type   := q.type;
      v_total_weight := v_total_weight + q_weight;

      IF q_type = 'scale' THEN
        diff := ABS(ans_creator::NUMERIC - ans_partner::NUMERIC);
        v_earned_weight := v_earned_weight + q_weight * (1 - diff / 4.0);
      ELSE
        IF LOWER(TRIM(ans_creator)) = LOWER(TRIM(ans_partner)) THEN
          v_earned_weight := v_earned_weight + q_weight;
        END IF;
      END IF;
    END LOOP;

    IF v_total_weight > 0 THEN
      v_score := ROUND((v_earned_weight / v_total_weight) * 100, 2);
    ELSE
      v_score := 0;
    END IF;

    UPDATE public.rooms
    SET
      status              = 'completed',
      compatibility_score = v_score,
      creator_done        = TRUE,
      partner_done        = TRUE,
      completed_at        = NOW()
    WHERE id = NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to answers table
DROP TRIGGER IF EXISTS on_answer_inserted ON public.answers;
CREATE TRIGGER on_answer_inserted
  AFTER INSERT ON public.answers
  FOR EACH ROW EXECUTE FUNCTION check_room_completion();

-- ============================================================
-- FUNCTION: Handle new user signup (auto-insert into users table)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'مستخدم'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
