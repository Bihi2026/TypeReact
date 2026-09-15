import { NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getConvexClerkToken } from "@/lib/convex-clerk";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;

  if (err || !code) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=youtube_error`
    );
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=youtube_config`
    );
  }

  const redirectUri = `${site.replace(/\/$/, "")}/api/social/youtube/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=youtube_token`
    );
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!tokens.access_token) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=youtube_token`
    );
  }

  let token: string;
  try {
    token = await getConvexClerkToken();
  } catch {
    return NextResponse.redirect(`${site}/sign-in`);
  }

  await fetchMutation(
    api.storyVideos.saveSocialAccount,
    {
      platform: "youtube",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
    },
    { token }
  );

  return NextResponse.redirect(
    `${site}/stories/dashboard?social=youtube_connected`
  );
}
