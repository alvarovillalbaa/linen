# Linen product contract

Status: source implementation, 27 October 2026. The editor, local media/portability helpers, public renderer and isolated publishing backend are authored. The owner has left free capacity pending; no Linen hosting, account or provider resource has been created or configured. Source publication and check evidence is maintained in [results](results/2026/10-27/source-readiness.md).

## Intent and evidence

Alvaro's [personal project queue](https://app.notion.com/p/311a1ee8bd06805caa21c5306dd315ac), page ID `311a1ee8bd06805caa21c5306dd315ac`, calls for Linen as an open-source alternative to Bento. The exact source quote, primary Bento references, inventory findings and limitations are maintained in [source and publishing research](research/2026/10-27/source-and-publishing.md).

The product outcome is a person creating, arranging and sharing their own public profile page without writing code. A visitor can see that person's content at a stable address. The author can later update that same address. This is a proposed implementation contract derived from the brief and Bento's documented experience, not a claim that the queue explicitly enumerates every requirement below.

## Required experience

- Create a profile with an avatar, name, biography and a responsive grid of content cards.
- Edit content directly in the page, arrange and resize cards, and support mouse, touch and keyboard interaction. Mobile authoring must be usable, not only mobile viewing.
- Support links, linked images, uploaded video, text and section headings, social cards, supported music/video embeds and a location card. Rich link previews should be generated where a source permits it, with editable text/cover and a working link fallback when metadata or embeds are unavailable.
- Publish a profile at a unique public handle, such as `/@handle`, with no visitor account requirement. Persist the published content and uploaded media independently of the author's browser storage.
- Let the author edit and republish at that same public address, unpublish it and delete it. Keep a clear distinction between a saved draft and the published revision.
- Serve profile-specific title, description and Open Graph metadata in the public HTML, plus a generated sharing image. A generic application preview is insufficient.
- Authenticate editing separately from public reading. Public pages, media, previews and exports must never disclose an editing credential or unpublished draft.
- Provide versioned project backup/import and static ZIP export with the profile's media. Export is an ownership and portability feature, not a substitute for hosted publishing.
- Preserve local drafts and failed edits during unavailable storage, failed uploads, quota exhaustion or backend errors. Show truthful saved/published status and allow retry without duplicate content.

These are the required content classes and outcomes. Exact grid dimensions, card sizes, upload limits, layout serialization and the supported embed allowlist are implementation choices to document before coding. Do not promise live social feeds or scrape restricted services to imitate them.

## Ownership and optional SaaS features

Secure ownership is required; email accounts are not inherently required. The authored approach uses a high-entropy owner credential with a separate recovery backup and cross-device editing. Read-only preview credentials are separate and revocable. If all owner credentials are lost, the product explains the recovery limit honestly. This policy exists as reviewable source; it has not been deployed or accepted at runtime.

Email/social sign-in, email recovery, custom domains, collaboration, analytics, subscriptions, AI generation, live social feeds and built-in checkout are optional additions. External product, booking and donation links should still work in the initial product. Do not make accounts or monetization infrastructure a prerequisite for viewing a profile.

## Proposed service boundary

Exact endpoint names can change; the following behavior must remain consistent across a hosted implementation and any self-hosting adapter.

| Operation | Required behavior |
| --- | --- |
| Create profile | Atomically reserve an available handle and establish owner credentials; retry safely. |
| Read and save draft | Require ownership; use revision preconditions to prevent lost updates. |
| Upload and attach media | Check ownership, supported types and quotas; attach only completed uploads and clean up failed reservations. |
| Publish | Atomically promote a valid revision and its completed media at the existing public handle. |
| Public page, media and sharing-image reads | Serve the published revision with appropriate metadata; do not expose unpublished material. |
| Preview | Issue a distinct, revocable read-only capability for cross-device draft review. |
| Unpublish and delete | Require ownership and confirmation for deletion; remove the service's public access without claiming to erase copies visitors already made. |
| Link preview | Retrieve permitted metadata with bounded, safe fetches; preserve a usable manual fallback. |
| Import and export | Validate versioned data, preserve layouts/media and omit all owner credentials from public exports. |

## Publishing and the free constraint

Stable persistent public profiles remain required. A serialized URL snapshot, read-only preview or downloadable ZIP alone does not satisfy this contract. The [research comparison](research/2026/10-27/source-and-publishing.md#publishing-options) records what each approach omits.

The proposed service would use an actually free plan and bounded usage. This research does not authorize a paid subscription, paid trial, metered Starter plan, automatic upgrade or chargeable overage. The owner's explicit no-paid-Supabase decision remains in force; an existing Vercel team plan has not been audited here. Capacity is a readiness question, not a reason to remove publishing from the product.

An isolated Convex Free project is a candidate for persistent content and media, subject to verifying remaining team-wide capacity and an eligible free frontend host. This is not a provider selection, allocation or readiness claim. Vercel Hobby's personal/noncommercial restriction must be considered before promising a hosted service for commercial creator profiles. Keep the application portable rather than assuming every public use fits that plan.

The owner explicitly left the capacity check pending. Do not re-ask for credentials, provision an alternative or alter existing projects while it is pending.

## Acceptance

1. Create a real profile with the required content classes; edit, rearrange and resize it through desktop, touch and keyboard controls. Unsupported external metadata or embeds leave working links and clear fallback states.
2. Publish it and open its content and uploaded media in a fresh browser with no author storage or session. Verify profile-specific HTML metadata and the sharing image.
3. Change content and republish. The same public address shows the new revision; concurrent/stale saves cannot silently overwrite newer edits.
4. Verify that a visitor or another profile owner cannot edit this profile, read its draft or obtain its ownership credentials. Revoking a preview does not alter the public profile.
5. Unpublish and verify the service stops serving that public profile and unpublished media. Delete only after owner confirmation. Do not claim revocation of downloaded/exported copies.
6. Export, clear author-local data and import a backup. Recover content, layouts and media without publishing accidentally or exposing private credentials in the public export.
7. Demonstrate failed-save/upload preservation, idempotent retries and quota handling without a chargeable upgrade or damage to other projects sharing free allowances.
8. Record source/static checks, hosted behavior, backend ownership checks and actual desktop/mobile browser acceptance separately. Source checks exist; hosted/backend/browser acceptance has not occurred for Linen.

## Current handoff

Application and isolated backend source now exist; see the [implementation contract](implementation-contract.md) and [source receipt](results/2026/10-27/source-readiness.md). No service is enabled. Free capacity, provider eligibility, installed dependency/build compatibility and runtime acceptance remain unverified. Preserve this full product contract while the owner's capacity check remains pending.
