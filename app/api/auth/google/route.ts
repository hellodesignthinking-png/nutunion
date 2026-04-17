import { NextResponse } from "next/server";
import { createOAuth2Client, GOOGLE_SCOPES } from "@/lib/google/auth";

export async function GET(req: Request) {
  const urlParams = new URL(req.url).searchParams;
  const returnTo = urlParams.get("returnTo") || "/dashboard";
  
  const oauth2Client = createOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state: Buffer.from(returnTo).toString("base64"),
  });

  return NextResponse.redirect(url);
}
