# Linen source and publishing research

Recorded 27 October 2026 from read-only research completed in the preceding session on 26 October. This note preserves the planning-phase evidence; subsequent source implementation is recorded in [source readiness](../../../results/2026/10-27/source-readiness.md). The owner has explicitly left the free-capacity check pending; no login request, provisioning or external change follows from this note.

## Canonical intent

Source: [Alvaro's personal project queue](https://app.notion.com/p/311a1ee8bd06805caa21c5306dd315ac), page ID `311a1ee8bd06805caa21c5306dd315ac`, under `Explore — Focus`.

Exact entry:

> ‘Linen’ — an alternative to Bento. Bento was recently acquired by Linktree. But many people loved Bento. It’s duplicating it and making it open-source. The problem is that building a website now is super-easy with AI.

The fetched parent reported last edit `2026-10-26T07:03:00.286Z`, `truncated: true` and three omitted blocks: `303a1ee8-bd06-802b-87a9-eb497c017edc`, `31ea1ee8-bd06-80d2-b45a-e19aa9deb17c` and `327a1ee8-bd06-8094-8bdb-ed976cf3e027`. No explicit prerequisite or do-not-implement instruction accompanied the Linen entry. This is a bounded reading of that entry, not an exhaustive audit of every parent subtree. No separate Linen child-page or bullet-block ID was exposed by the inspected source.

The word "recently" belongs to the historical brief. Linktree's own [6 June 2023 acquisition announcement](https://linktr.ee/blog/operational-and-team-updates1) establishes the acquisition date; do not present it as a new 2026 event.

## Primary Bento evidence

| Inspected primary source | What it supports |
| --- | --- |
| [Original Bento landing page](https://landing.bento.me/) | A free personal page, a unique public `bento.me/name` address and integrated content including media, newsletters, products and calendars. The page also carries a sunset notice. |
| [Bento designer Eike Drescher's firsthand case study](https://www.eikedrescher.com/) | A custom grid, mobile drag-and-drop, direct WYSIWYG manipulation, rich social previews, text/maps/music widgets, linked images and an automatically generated sharing image representing the page. |
| [Linktree acquisition announcement](https://linktr.ee/blog/operational-and-team-updates1) | The original product's focus on visual expression and creator identity, and its acquisition in June 2023. |

The live Bento editor/profile service was not inspected: the main domain fetch returned `403`, and the landing page's sunset-announcement link returned `404`. No login, form submission, account creation or interactive browser check was performed. Do not claim a current Bento editor walkthrough, complete widget catalogue or pixel-perfect comparison. The similarly named `bentome.link` was not used as evidence for the original product.

Inference: a faithful alternative needs a useful authoring experience and a durable public identity that can be updated. A good-looking local editor alone does not deliver the outcome described by the original public-address offering. The proposed [product contract](../../../spec.md) derives requirements from these sources; its API shape, limits and ownership approach are design proposals rather than quoted source instructions.

## Existing-project reconciliation

The 26 October snapshot contained **49 owned GitHub repositories**, inspected through the connected repository list and an authenticated owner-filtered names/descriptions API read. No name or description matched Linen/Bento. A bounded SIDE inventory inspected directories to depth two and searched non-vendor Markdown references; it found no Linen/Bento implementation reference. These are no-match results within that inspected scope, not proof that no code exists elsewhere or in every repository file.

- [avillalba's home source](https://github.com/alvarovillalbaa/avillalba/blob/main/app/page.tsx) describes Alvaro's personal portfolio. Its inspected recursive tree was untruncated with 270 paths and no builder/profile/editor/dashboard path match. This supports distinguishing a page-creation product from that personal website; it is not a full source audit of avillalba.
- [Search Gateway](https://github.com/alvarovillalbaa/search-gateway) provides internet-provider search infrastructure, not public profile creation.
- [vAFS](https://github.com/alvarovillalbaa/vafs/blob/main/README.md) provides AFS workspace infrastructure, console/API/CLI/MCP interfaces and retrieval, not this profile builder.

The repository count is a dated snapshot, not a current synchronization claim. No new repository or implementation was created during this research.

## Publishing options

| Mechanism | Useful outcome | What remains materially missing |
| --- | --- | --- |
| Static ZIP export | A portable page with media that the author can independently host. | An immediately hosted profile address and updates at that address, unless a real deployment path is also delivered. |
| Serialized snapshot in a URL | A recipient can view the encoded snapshot without the author's local storage, subject to URL/media limits. | Stable same-link updates and withdrawal of old snapshots. Fragment-only content does not supply profile-specific server HTML or sharing metadata. Local blob URLs do not make uploaded media portable. |
| Server-stored capability preview | A cross-device draft review link that the service can revoke. | It still requires persistence. A review capability is not the public profile identity or publication workflow. |
| Persistent hosted public profile | A stable public handle, durable content/media, same-link updates, sharing metadata and author-controlled publication. | This is the required publishing outcome, with storage, ownership and hosting capacity to establish. |

Capabilities for editing and previewing must be separate. Publishing creates public material; unpublishing can remove access through the service but cannot erase copies already downloaded or exported. Static export and previews remain useful supplements, not a smaller replacement end state.

## Free-plan findings and pending capacity

- [Convex limits](https://docs.convex.dev/production/state/limits) distinguish **Free**, with hard resource caps, from **Starter**, which can incur usage-based charges. A $0 base price is not sufficient evidence of a no-charge plan.
- [Convex's pricing FAQ](https://www.convex.dev/pricing/faq) states that allowances are measured across the team, summing its projects. A separate Linen project would not create an independent allowance. Free-plan exhaustion can return errors; it does not establish unlimited availability.
- [Convex file upload documentation](https://docs.convex.dev/file-storage/upload-files) provides a candidate durable-media mechanism. It does not establish that this account has spare capacity or that Linen is configured.
- [Vercel's terms](https://vercel.com/legal/terms) restrict Hobby to personal/noncommercial use. A public service for commercial creator profiles cannot be assumed eligible merely because the application charges nothing. The hosting choice must preserve the complete publishing contract and the owner's free constraint.

An isolated Convex Free project and a compatible frontend host are candidates only. No account plan, remaining allowance, new project, backend endpoint, media bucket, credentials or deployable application has been verified or provisioned for Linen. No alternative provider account was created. Do not change existing applications, share their private data or weaken their access model to bypass capacity limits.

The owner has left this capacity check pending. Do not re-ask for login or setup, upgrade a plan, provision another resource or claim that static export resolves the missing hosted service. Preserve the required end state until that check is explicitly resumed.

The 27 October capacity attempt found the existing Convex dashboard signed out in the connected Chrome profile. No Convex or Vercel CLI was installed. The connected Vercel integration-configuration read returned `403 forbidden`; it was not retried or treated as permission to obtain different credentials. The owner answered **“Leave capacity check pending”** to the login handoff. No plan, remaining allowance or resource was established. This gates dependent provisioning; source work independent of that capacity decision can still follow the broader implementation goal.

## Proof and handoff

Completed by the original research pass: connector/source reading, primary-source web research, the dated repository names/descriptions comparison, bounded local inspection and the planning handoff. That pass created no application code, dependencies, native tooling, runtime tests, browser acceptance, Git repository, backend, deployment or external resource. Later source work has separate evidence in [source readiness](../../../results/2026/10-27/source-readiness.md).

The product requirements and proposed acceptance criteria live in [docs/spec.md](../../../spec.md). Future verification must distinguish source checks, deployed public/profile behavior, owner isolation, data preservation and approved desktop/mobile browser checks. These documents do not establish implementation readiness or completion of the broader personal-project goal.
