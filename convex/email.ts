"use node";

/**
 * Transactional notification emails via Resend.
 *
 * Required Convex env (dashboard / `npx convex env set`):
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL (e.g. "TypeReact <notifications@yourdomain.com>")
 * - SITE_URL (absolute app origin, e.g. https://app.example.com)
 *
 * Missing RESEND_API_KEY → action logs and returns without throwing.
 */

import { v } from "convex/values";
import { Resend } from "resend";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { notificationCategory } from "./lib/validators";

const categoryLabel: Record<
  | "reply"
  | "mention"
  | "follower"
  | "following"
  | "creator-response"
  | "evidence"
  | "verification"
  | "message"
  | "circle",
  string
> = {
  reply: "Replies",
  mention: "Mentions",
  follower: "Followers",
  following: "Following",
  "creator-response": "Creator Responses",
  evidence: "Evidence Updates",
  verification: "Verification",
  message: "Messages",
  circle: "Research Circles",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absoluteUrl(href: string) {
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  if (/^https?:\/\//i.test(href)) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${site}${path}`;
}

export const sendNotificationEmail = internalAction({
  args: {
    recipientClerkId: v.string(),
    category: notificationCategory,
    title: v.string(),
    body: v.string(),
    href: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn(
        "[email] RESEND_API_KEY is not set; skipping notification email"
      );
      return null;
    }

    const recipient = await ctx.runQuery(internal.emailQueries.getRecipient, {
      recipientClerkId: args.recipientClerkId,
    });
    if (!recipient) {
      console.warn(
        `[email] No email for recipient ${args.recipientClerkId}; skipping`
      );
      return null;
    }

    const from =
      process.env.RESEND_FROM_EMAIL?.trim() ||
      "TypeReact <onboarding@resend.dev>";
    const url = absoluteUrl(args.href);
    const label = categoryLabel[args.category] ?? "Notification";
    const safeTitle = escapeHtml(args.title);
    const safeBody = escapeHtml(args.body);
    const safeName = escapeHtml(recipient.name);

    const text = [
      `Hi ${recipient.name},`,
      "",
      args.title,
      args.body,
      "",
      `Category: ${label}`,
      `Open: ${url}`,
      "",
      "— TypeReact",
    ].join("\n");

    const html = `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.5; color: #111; background: #f6f6f4; padding: 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #e8e6e1;">
      <tr>
        <td>
          <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b6b6b;">${escapeHtml(label)}</p>
          <h1 style="margin: 0 0 12px; font-size: 20px; font-weight: 650;">${safeTitle}</h1>
          <p style="margin: 0 0 20px; font-size: 15px; color: #333;">Hi ${safeName},</p>
          <p style="margin: 0 0 24px; font-size: 15px; color: #333;">${safeBody}</p>
          <p style="margin: 0 0 28px;">
            <a href="${escapeHtml(url)}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600;">Open in TypeReact</a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #888;">You’re receiving this because email notifications are enabled in your settings.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to: recipient.email,
        subject: args.title,
        text,
        html,
      });
      if (result.error) {
        console.error("[email] Resend error:", result.error);
      }
    } catch (error) {
      console.error("[email] Failed to send notification email:", error);
    }

    return null;
  },
});
