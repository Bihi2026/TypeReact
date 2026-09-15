"use server";

import {
  getCreatorByExternalIdentityAction,
  listApprovedCreators,
} from "@/app/actions/creators";
import { sources } from "@/lib/data";
import { resolveExternalIdentity } from "@/lib/creators/external-identity";
import { matchApprovedCreator } from "@/lib/creators/match-source";
import {
  applyRemoteMeta,
  detectSource,
  isTikTokShortHost,
  parsePublicUrl,
  type DetectedSource,
} from "@/lib/detect-source";
import {
  remoteMetaIsLimited,
  resolveTikTokUrl,
  unfurlSource,
} from "@/lib/unfurl";

async function withApprovedCreator(
  detected: DetectedSource,
  url: string,
  authorName?: string,
  authorHandle?: string
): Promise<DetectedSource> {
  try {
    const approved = await listApprovedCreators();
    const matched = matchApprovedCreator(
      {
        url,
        platform: detected.source.platform,
        authorName,
        authorHandle,
      },
      approved
    );
    if (!matched) return detected;
    if (
      detected.creator?.hasTeaBarksProfile &&
      detected.creator.id === matched.id
    ) {
      return detected;
    }
    return {
      ...detected,
      source: { ...detected.source, creatorId: matched.id },
      creator: matched,
    };
  } catch {
    return detected;
  }
}

async function withUnclaimedCreator(
  detected: DetectedSource,
  url: string,
  authorName?: string,
  authorHandle?: string
): Promise<DetectedSource> {
  if (detected.creator?.hasTeaBarksProfile) return detected;

  const identity = resolveExternalIdentity({
    url,
    platform: detected.source.platform,
    authorName,
    authorHandle,
  });
  if (!identity) return detected;

  try {
    const unclaimed = await getCreatorByExternalIdentityAction({
      platform: identity.platform,
      externalHandle: identity.externalHandle,
    });
    if (!unclaimed || unclaimed.hasTeaBarksProfile) return detected;
    return {
      ...detected,
      source: { ...detected.source, creatorId: unclaimed.id },
      creator: unclaimed,
    };
  } catch {
    return detected;
  }
}

export async function analyzeSourceUrl(
  raw: string
): Promise<DetectedSource | null> {
  let working = raw.trim();
  const parsed = parsePublicUrl(working);
  if (parsed && isTikTokShortHost(parsed.hostname)) {
    working = await resolveTikTokUrl(working);
  }

  const detected = detectSource(working, sources);
  if (!detected) return null;

  const sourceUrl = detected.source.url || working;

  if (!detected.source.id.startsWith("detect:")) {
    const withApproved = await withApprovedCreator(detected, sourceUrl);
    return await withUnclaimedCreator(withApproved, sourceUrl);
  }

  const meta = await unfurlSource(sourceUrl, detected.source.platform);
  if (!meta) {
    const limited = await withApprovedCreator(
      { ...detected, detailsLimited: true },
      sourceUrl
    );
    return await withUnclaimedCreator(limited, sourceUrl);
  }

  const enriched = {
    ...applyRemoteMeta(detected, meta),
    detailsLimited: remoteMetaIsLimited(meta),
  };
  const withApproved = await withApprovedCreator(
    enriched,
    sourceUrl,
    meta.authorName,
    meta.authorHandle
  );
  return await withUnclaimedCreator(
    withApproved,
    sourceUrl,
    meta.authorName,
    meta.authorHandle
  );
}
