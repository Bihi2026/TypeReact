import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const seedStarterContent = internalMutation({
  args: {},
  returns: v.object({ inserted: v.number(), skipped: v.boolean() }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("learningResources").first();
    if (existing) return { inserted: 0, skipped: true };

    const now = Date.now();
    const authorClerkId = "system";

    const resources = [
      {
        slug: "welcome-to-typereact",
        title: "Welcome to TypeReact",
        description:
          "A quick tour of how evidence-based reactions work on TypeReact.",
        type: "video" as const,
        category: "getting-started" as const,
        sortOrder: 0,
        durationMinutes: 5,
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoPlatform: "youtube" as const,
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      {
        slug: "write-evidence-based-reaction",
        title: "How to write an evidence-based reaction",
        description:
          "Structure your analysis, cite sources, and link claims to evidence.",
        type: "article" as const,
        category: "reactions" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "heading" as const,
            text: "Start with the source",
          },
          {
            kind: "paragraph" as const,
            text: "Every reaction on TypeReact responds to an original source — a video, article, speech, or statement. Paste the URL and confirm the detected metadata before you write.",
          },
          {
            kind: "heading" as const,
            text: "Make claims you can support",
          },
          {
            kind: "paragraph" as const,
            text: "Break your analysis into clear claims. Attach screenshots, timestamps, documents, or links as evidence for each point you make.",
          },
          {
            kind: "quote" as const,
            text: "A reaction without evidence is just an opinion.",
            attribution: "TypeReact Evidence Standards",
          },
          {
            kind: "list" as const,
            items: [
              "Quote or paraphrase the source accurately",
              "Add at least one piece of evidence per major claim",
              "Label speculation clearly when you cannot verify",
            ],
          },
        ],
      },
      {
        slug: "evidence-checklist",
        title: "Evidence checklist (PDF)",
        description:
          "Download a printable checklist for evaluating claims before you publish.",
        type: "download" as const,
        category: "evidence" as const,
        sortOrder: 0,
        externalDownloadUrl:
          "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
        fileName: "evidence-checklist.pdf",
        fileContentType: "application/pdf",
      },
      {
        slug: "open-accountability-case",
        title: "Opening an accountability case",
        description:
          "When a pattern of claims deserves sustained scrutiny, open a case.",
        type: "article" as const,
        category: "cases" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Cases are for ongoing accountability — not single hot takes. Gather reactions, timeline events, and community analysis in one place.",
          },
        ],
      },
      {
        slug: "creator-verification",
        title: "Creator verification overview",
        description:
          "How public figures claim their profile and respond officially on TypeReact.",
        type: "article" as const,
        category: "creators" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Verified creators can post official responses linked to reactions and cases about their work.",
          },
        ],
      },
      {
        slug: "platform-tour",
        title: "Platform tour: Explore and Research Circles",
        description:
          "Find trending sources by country and collaborate in private research circles.",
        type: "article" as const,
        category: "platform" as const,
        sortOrder: 0,
        contentBlocks: [
          {
            kind: "paragraph" as const,
            text: "Use Explore to filter reactions, sources, and cases by country. Research Circles let teams coordinate around a case or topic.",
          },
        ],
      },
    ];

    for (const resource of resources) {
      await ctx.db.insert("learningResources", {
        ...resource,
        status: "published",
        publishedAt: now,
        updatedAt: now,
        authorClerkId,
      });
    }

    return { inserted: resources.length, skipped: false };
  },
});
