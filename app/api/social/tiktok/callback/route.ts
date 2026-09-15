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
      `${site}/stories/dashboard?social=tiktok_error`
    );
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=tiktok_config`
    );
  }

  const redirectUri = `${site.replace(/\/$/, "")}/api/social/tiktok/callback`;
  const tokenRes = await fetch(
    "https://open.tiktokapis.com/v2/oauth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    }
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=tiktok_token`
    );
  }

  const payload = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
    data?: {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      open_id?: string;
    };
  };
  const tokens = payload.data ?? payload;
  if (!tokens.access_token) {
    return NextResponse.redirect(
      `${site}/stories/dashboard?social=tiktok_token`
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
      platform: "tiktok",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? "").split(",").filter(Boolean),
      expiresAt: tokens.expires_in
        ? Date.now() + tokens.expires_in * 1000
        : undefined,
      platformUserId: tokens.open_id,
    },
    { token }
  );

  return NextResponse.redirect(
    `${site}/stories/dashboard?social=tiktok_connected`
  );
}
