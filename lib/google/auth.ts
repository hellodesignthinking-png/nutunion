import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

/**
 * Create a base OAuth2 client (no credentials set)
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * All Google Workspace scopes we request
 */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/presentations.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/chat.spaces",
  "https://www.googleapis.com/auth/chat.messages",
];

/**
 * Get an authenticated Google OAuth2 client for a specific user.
 * Automatically refreshes token if expired.
 */
export async function getGoogleClient(userId: string) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();

  if (error || !profile?.google_access_token) {
    throw new Error("GOOGLE_NOT_CONNECTED");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: profile.google_access_token,
    refresh_token: profile.google_refresh_token,
  });

  // Auto-refresh if token expired
  const now = new Date();
  const expiry = profile.google_token_expiry ? new Date(profile.google_token_expiry) : new Date(0);
  if (now >= expiry && profile.google_refresh_token) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Save refreshed token
      await supabase
        .from("profiles")
        .update({
          google_access_token: credentials.access_token,
          google_token_expiry: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        })
        .eq("id", userId);
    } catch {
      throw new Error("GOOGLE_TOKEN_EXPIRED");
    }
  }

  return oauth2Client;
}

/**
 * Helper: get current user ID from Supabase auth
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}
