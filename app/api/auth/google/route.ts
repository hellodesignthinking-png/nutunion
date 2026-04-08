import { NextResponse } from "next/server";
import { createOAuth2Client, GOOGLE_SCOPES } from "@/lib/google/auth";

export async function GET() {
  const oauth2Client = createOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });

  return NextResponse.redirect(url);
}
