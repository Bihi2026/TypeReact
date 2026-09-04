/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as barkNotes from "../barkNotes.js";
import type * as barks from "../barks.js";
import type * as cases from "../cases.js";
import type * as clerk from "../clerk.js";
import type * as contests from "../contests.js";
import type * as creatorReviews from "../creatorReviews.js";
import type * as creatorVerifications from "../creatorVerifications.js";
import type * as creators from "../creators.js";
import type * as email from "../email.js";
import type * as emailQueries from "../emailQueries.js";
import type * as evidenceFiles from "../evidenceFiles.js";
import type * as follows from "../follows.js";
import type * as http from "../http.js";
import type * as learning from "../learning.js";
import type * as learningSeed from "../learningSeed.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_content_blocks from "../lib/content_blocks.js";
import type * as lib_creator_identity from "../lib/creator_identity.js";
import type * as lib_moderation from "../lib/moderation.js";
import type * as lib_mutes from "../lib/mutes.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_validators from "../lib/validators.js";
import type * as mentions from "../mentions.js";
import type * as messages from "../messages.js";
import type * as mutes from "../mutes.js";
import type * as notifications from "../notifications.js";
import type * as org from "../org.js";
import type * as profiles from "../profiles.js";
import type * as researchCircles from "../researchCircles.js";
import type * as saves from "../saves.js";
import type * as stories from "../stories.js";
import type * as storySocial from "../storySocial.js";
import type * as userSettings from "../userSettings.js";
import type * as writers from "../writers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  barkNotes: typeof barkNotes;
  barks: typeof barks;
  cases: typeof cases;
  clerk: typeof clerk;
  contests: typeof contests;
  creatorReviews: typeof creatorReviews;
  creatorVerifications: typeof creatorVerifications;
  creators: typeof creators;
  email: typeof email;
  emailQueries: typeof emailQueries;
  evidenceFiles: typeof evidenceFiles;
  follows: typeof follows;
  http: typeof http;
  learning: typeof learning;
  learningSeed: typeof learningSeed;
  "lib/admin": typeof lib_admin;
  "lib/auth": typeof lib_auth;
  "lib/content_blocks": typeof lib_content_blocks;
  "lib/creator_identity": typeof lib_creator_identity;
  "lib/moderation": typeof lib_moderation;
  "lib/mutes": typeof lib_mutes;
  "lib/notify": typeof lib_notify;
  "lib/validators": typeof lib_validators;
  mentions: typeof mentions;
  messages: typeof messages;
  mutes: typeof mutes;
  notifications: typeof notifications;
  org: typeof org;
  profiles: typeof profiles;
  researchCircles: typeof researchCircles;
  saves: typeof saves;
  stories: typeof stories;
  storySocial: typeof storySocial;
  userSettings: typeof userSettings;
  writers: typeof writers;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
