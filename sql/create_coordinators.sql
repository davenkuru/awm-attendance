-- ══════════════════════════════════════════════════════════
--  AWM / ZTCC — Create Coordinator Accounts
--  Run this in: Supabase Dashboard → SQL Editor
--
--  BEFORE RUNNING: replace the four placeholder values below
--    LEVEL1_EMAIL    → e.g. 'coord.level1@awm.org'
--    LEVEL1_PASSWORD → e.g. 'SecurePass123!'
--    LEVEL2_EMAIL    → e.g. 'coord.level2@awm.org'
--    LEVEL2_PASSWORD → e.g. 'SecurePass456!'
-- ══════════════════════════════════════════════════════════

DO $$
DECLARE
  -- ── EDIT THESE FOUR VALUES ──────────────────────────────
  l1_email    TEXT := 'LEVEL1_EMAIL';
  l1_password TEXT := 'LEVEL1_PASSWORD';
  l2_email    TEXT := 'LEVEL2_EMAIL';
  l2_password TEXT := 'LEVEL2_PASSWORD';
  -- ────────────────────────────────────────────────────────

  l1_id UUID := gen_random_uuid();
  l2_id UUID := gen_random_uuid();
  now_ts TIMESTAMPTZ := now();
BEGIN

  -- ── Level 1 Coordinator ─────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    l1_id,
    'authenticated',
    'authenticated',
    l1_email,
    crypt(l1_password, gen_salt('bf')),
    now_ts,
    '{"provider":"email","providers":["email"]}',
    '{"role":"coordinator","level_id":1}',
    now_ts, now_ts,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    l1_id,
    l1_email,
    'email',
    jsonb_build_object('sub', l1_id::text, 'email', l1_email),
    now_ts, now_ts, now_ts
  );

  -- ── Level 2 Coordinator ─────────────────────────────────
  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    l2_id,
    'authenticated',
    'authenticated',
    l2_email,
    crypt(l2_password, gen_salt('bf')),
    now_ts,
    '{"provider":"email","providers":["email"]}',
    '{"role":"coordinator","level_id":2}',
    now_ts, now_ts,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    l2_id,
    l2_email,
    'email',
    jsonb_build_object('sub', l2_id::text, 'email', l2_email),
    now_ts, now_ts, now_ts
  );

  RAISE NOTICE 'Created Level 1 coordinator: % (id: %)', l1_email, l1_id;
  RAISE NOTICE 'Created Level 2 coordinator: % (id: %)', l2_email, l2_id;

END $$;
