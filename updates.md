TYPE REACT — CREATOR PROFILE, VERIFICATION & REACTION SYSTEM

Priority: HIGH / CORE PLATFORM FEATURE

This entire Creator Profile system should be treated as a core part of TypeReact. Do not treat it as a cosmetic feature.

1. CREATOR IDENTIFICATION WHEN CREATING A REACTION

When a user creates a reaction about a content creator, the reaction form must first identify the creator.

The creator section should include:

Creator Name

Username / Handle

Platform

Creator Profile URL


The user enters the creator's handle and selects the platform.

Supported platforms can include:

Instagram

TikTok

YouTube

Facebook

X

Other platforms as needed


2. VERIFY THE HANDLE BEFORE CONTINUING

When the user enters a handle, TypeReact should check whether that username exists on the selected platform.

If a matching account is found, show the available information and ask:

“Is this the correct creator?”

Show:

Creator name

Username

Platform

Profile image when available

Profile link


The user must confirm:

YES — THIS IS THE CORRECT CREATOR

or

NO — SEARCH AGAIN

Do not automatically assume that a matching username belongs to the correct person.

3. ONE CREATOR = ONE TYPE REACT PROFILE

After the creator is confirmed, TypeReact must check its own database.

NO DUPLICATE CREATOR PROFILES.

If that creator already exists, attach the new reaction to the existing Creator Profile.

If the creator does not exist, create a new Creator Profile.

For example:

Rafiki Joseph
@rafikiaskingpeople_
Instagram

If 50 different users write reactions about Rafiki Joseph, there must still be ONE Creator Profile containing all 50 reactions.

Do not create variations such as:

Rafiki Joseph — Unclaimed

Rafiki Joseph 2

@rafikiaskingpeople_

Rafiki Asking People


Everything must connect to the same canonical creator profile.

4. NORMAL REACTION CREATION CONTINUES AFTER CREATOR IDENTIFICATION

Once the creator has been identified and confirmed, the user continues with the normal TypeReact reaction process.

Identify Creator → Verify Handle → Confirm Person → Find/Create Creator Profile → Enter Original Video/Source → Pull Available Source Information → Write Reaction → Add Evidence/Sources → Publish

The reaction must automatically be connected to that creator's profile.


---

5. CREATOR DIRECTORY

The Creators page must display actual creators.

Do NOT display generic entries such as:

> Instagram
Unclaimed



Instead, display:

> Creator Name
@username
Instagram
UNCLAIMED
7 TypeReact Reactions
View Profile



Every creator card must be clickable.

Unclaimed creators must remain completely discoverable.


---

6. UNCLAIMED CREATOR PROFILES

An unclaimed profile is still a complete public profile.

It should display:

Creator name

Username/handle

Platform

Profile image when available

Original profile link

UNCLAIMED status

Number of TypeReact reactions

Available public information

CLAIM THIS PROFILE button


Unclaimed does NOT mean empty.

The only difference is that the creator has not yet verified ownership.


---

7. CREATOR PROFILE PAGE

Every creator should have a dedicated page.

Example:

Creator Name

@username
Instagram

UNCLAIMED

24 TypeReact Reactions

Official Creator Responses: 0

[CLAIM THIS PROFILE]

Then:

Reactions About This Creator

Display all TypeReact reactions connected to that creator.

Each reaction should show relevant information such as:

Title

Author

Date

Reaction/discussion activity

Evidence/sources where applicable

Link to read the complete reaction


If 24 people have reacted to the creator, visitors should be able to see those 24 reactions from the creator's profile.


---

8. CREATOR PROFILE CLAIMING

Every unclaimed creator profile must have a prominent:

CLAIM THIS PROFILE

button.

The person claiming the profile must prove that they actually control the creator account.

A successful verification changes:

UNCLAIMED → CLAIMED / VERIFIED

Once verified, the creator receives access to their Creator Dashboard.


---

9. CREATOR VERIFICATION

The creator must submit information necessary to establish ownership and protect the account.

Collect:

Full name

Creator name, if different

Country/location

Primary email

Primary phone number

Creator username/handle

Platform(s)

Official social-media account links

Other verification information when reasonably necessary


Social-media verification

TypeReact should generate a unique Story ID / Verification ID or verification link associated with the creator's profile/reaction.

The creator must post the provided verification information from an official social-media account they control.

For example:

“I am claiming my TypeReact Creator Profile. Verification ID: TR-XXXXXX.”

The creator then submits the public post/link back to TypeReact.

TypeReact verifies that the person has control of the account.

Once ownership is confirmed:

CLAIMED / VERIFIED


---

10. EMERGENCY ACCOUNT-RECOVERY CONTACTS

During verification, allow the creator to provide at least two trusted emergency/recovery contacts.

Collect:

Contact name

Phone number

Relationship/connection to the creator where appropriate


These contacts are strictly for account-security and recovery purposes.

They must NOT automatically receive access to the creator's account.

They should only be used through a defined recovery process if there is:

Suspected account takeover

Lost access

Compromised account

Serious ownership dispute

Other legitimate account-security emergency


The system should use multiple verification factors before restoring access.

Do not rely on one phone number or one recovery contact alone.


---

11. PRIVATE VERIFICATION INFORMATION

Private verification information must never automatically appear on the public Creator Profile.

Do NOT publicly display:

Personal phone numbers

Private email addresses

Legal information

Emergency-contact information

Private verification documents

Sensitive recovery information


The public profile should only display information intended to be public.


---

12. OFFICIAL CREATOR RESPONSE — TOP PRIORITY

Once a creator has successfully claimed and verified their profile, they receive access to:

OFFICIAL CREATOR RESPONSE

Only the verified creator can publish an official response.

Regular TypeReact users cannot post inside the official creator-response section.

Every official response must be clearly labeled:

✓ OFFICIAL CREATOR RESPONSE

The creator should be able to respond directly to individual TypeReact reactions about them.

Example:

TypeReact Reaction
“Why I Disagree With…”

↓

✓ OFFICIAL CREATOR RESPONSE

Creator's response

The connection between the reaction and the official response must remain permanent and clear.


---

13. OFFICIAL RESPONSE MUST BE PROMINENT

The creator's official response should be positioned near the top of the relevant reaction page.

Do not bury the creator's response deep inside the comments.

If there is no response yet, the system can display:

Creator Response
The creator has not responded to this reaction.

Once they respond, the official response becomes prominently visible.


---

14. MULTIPLE REACTIONS ABOUT ONE CREATOR

A creator profile should become the central hub for every TypeReact reaction about that creator.

Example:

Creator Profile

→ Reaction #1
→ Reaction #2
→ Reaction #3
→ Reaction #4
→ Reaction #5
→ Reaction #6
→ Reaction #7

The creator should be able to see all reactions about them and respond to individual reactions.

Visitors should be able to see the creator's official responses alongside the relevant reactions.


---

15. CREATOR DIRECTORY SEARCH

Users should be able to search the Creator directory by:

Creator name

Username/handle

Platform

Category/topic

Claimed/Unclaimed status


Unclaimed creators must remain searchable and discoverable.


---

16. DATABASE ARCHITECTURE

The Creator Profile must have a unique canonical creator record.

Use reliable identifiers such as:

Platform

Platform username/handle

Platform profile URL

Platform creator ID where available


Before creating a creator profile, the system must check for an existing matching creator.

Never create a duplicate simply because someone entered the creator's name differently.

All reactions must reference the creator's unique/canonical Creator ID.

Core relationship:

ONE CREATOR
↓
ONE CREATOR PROFILE
↓
MANY TYPE REACT REACTIONS
↓
MANY DISCUSSIONS / RESPONSES
↓
OFFICIAL CREATOR RESPONSES


---

