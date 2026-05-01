import { NextResponse } from "next/server";
import { log } from "@/lib/observability/logger";
import { withRouteLog } from "@/lib/observability/route-handler";
import { createOAuth2Client, GOOGLE_SCOPES } from "@/lib/google/auth";

export const GET = withRouteLog("auth.google", async (req: Request) => {
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
});
