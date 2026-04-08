-- Add Google OAuth token columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_token_expiry TIMESTAMPTZ;

-- RLS: Only the user can read/update their own Google tokens
CREATE POLICY "Users can read own google tokens"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Ensure tokens are not exposed in public queries
COMMENT ON COLUMN profiles.google_access_token IS 'Google OAuth access token - private';
COMMENT ON COLUMN profiles.google_refresh_token IS 'Google OAuth refresh token - private';
COMMENT ON COLUMN profiles.google_token_expiry IS 'Google token expiry timestamp';
