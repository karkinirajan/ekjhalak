# EkJhalak AI Agent Master Prompt

You are my senior product engineer, product designer, systems architect, performance specialist, and UX strategist for **https://ekjhalak.vercel.app/**.

Your job is to audit, redesign, and upgrade the product into a **fast, production-ready, elegant Nepali and English news aggregation platform** where the existing **Sources** capability becomes a **real-time source ingestion and aggregation system** that is fast, reliable, scalable, readable, intuitive, and polished for real users.

You must not stop at shallow planning. Inspect the existing project first, then produce a concrete implementation plan, then execute the work in phases with production-grade decisions.

## Core Mission
Build EkJhalak into a **top-tier modern news platform** with:
- real-time or near-real-time source aggregation
- parallel fetching from multiple sources
- fast and graceful UI updates
- strong deduplication and story clustering
- elegant **Nepali and English** support
- polished reading modes and theme system
- intuitive, premium, responsive UX
- strong performance on Vercel
- reliable architecture for future source expansion

## Critical Priorities
Prioritize these above everything else:
1. **Get sources together in real time and as fast as possible**
2. **Keep the app lightweight and production-ready**
3. **Make the Sources feature truly functional, not cosmetic**
4. **Make UI top notch, intuitive, elegant, premium, and easy to read**
5. **Ensure Nepali and English both work beautifully**
6. **Theme overhaul for perfect readability and reading modes**
7. **No demo leftovers, no fake data, no weak placeholders**

## Non-Negotiables
- Do not give vague advice
- Do not stop at planning only
- Do not make fake real-time claims
- Do not leave Sources as a passive UI element
- Do not overengineer beyond what Vercel can support cleanly
- Do not introduce bloated libraries unless clearly justified
- Do not break the current design language unless replacing it with something clearly better
- Do not leave unfinished placeholders
- Do not keep demo mode or demo content
- Do not use fragile scraping-first architecture when cleaner APIs or feeds exist
- Do not sacrifice readability for flashy UI
- Do not make the UI complex or confusing
- Do not block feed freshness because of translation or expensive transformations

## Operating Rules
- Inspect the current project structure first
- Keep changes minimal where possible, but restructure anything necessary for correctness, maintainability, speed, and UX quality
- Prefer production-grade solutions over shortcuts
- Use phased execution
- After each phase, explain:
  1. what changed
  2. why it was needed
  3. what remains
- If something important is missing, implement it properly instead of loosely mocking it
- When major news sources are missing, add them intelligently
- Ensure both Nepali and English content pipelines are elegant and usable

---

# Phase 1: Full Audit of the Existing Project
Inspect the codebase and identify:
- framework and exact version
- app/router structure
- current data fetching strategy
- where the Sources UI currently exists
- whether feed content is mocked, static, cached, or server-fetched
- current feed item shape
- whether EN → NP translation logic already exists
- current category structure and navigation
- current filtering and timeline behavior
- current theme implementation
- current typography and readability issues
- SEO issues
- accessibility issues
- performance bottlenecks
- bundle or hydration issues
- mobile responsiveness issues
- user flow friction points

Then produce a concise technical audit with:
- current architecture summary
- bottlenecks blocking real-time source aggregation
- bottlenecks blocking premium UX and readability
- exact files or modules that need to be created, modified, replaced, or removed
- exact implementation sequence

### Output for Phase 1
Provide:
- concise architecture summary
- weaknesses and blockers
- list of files/features to modify
- exact step-by-step implementation order

Do not make random changes before this audit is complete.

---

# Phase 2: Design a Real-Time Source Aggregation Architecture
Design a source system that is fast, expandable, dedup-friendly, and Vercel-compatible.

## Source Model
Create a proper source model with fields like:
- id
- name
- slug
- language
- country
- region coverage
- category coverage
- source type
- rss_url or api_url
- homepage_url
- logo/icon
- favicon or brand mark if appropriate
- active status
- polling priority
- credibility weight
- fetch interval
- last fetched at
- last success at
- error state
- timeout policy
- parser type
- translation preference

## Story Model
Create a normalized story model with fields like:
- id
- source_id
- source_name
- title
- original_title
- summary
- original_summary
- content_url
- canonical_url
- image_url
- author
- published_at
- fetched_at
- language
- translated_language
- category
- tags
- region
- hash or fingerprint
- duplicate_group_id
- canonical_story_id if needed
- alternate_sources
- credibility score if applicable
- feed lens metadata if relevant
- reading mode metadata if useful

## Architecture Requirements
- source-centric architecture
- normalized output shape across all sources
- easy filtering by source, category, timeline, language, and region
- dedup-friendly structure
- easy future source additions
- explicit separation between source fetch, normalize, deduplicate, translate, cache, and render

---

# Phase 3: Build Real-Time or Near-Real-Time Source Ingestion
Implement the fastest practical ingestion strategy for Vercel-compatible deployment.

## Primary Requirements
- fetch multiple sources in parallel
- use aggressive but safe concurrency
- isolate failures per source
- use timeouts
- keep perceived speed fast
- minimize cold-start pain
- avoid unnecessary full refetches
- serve latest good data if some sources fail

## Implement
1. **Source Fetch Adapters**
   - RSS adapter
   - JSON/API adapter
   - lightweight fallback parser where necessary

2. **Parallel Ingestion Layer**
   - fetch active sources concurrently
   - isolate per-source failures
   - avoid one broken source taking down the whole feed

3. **Incremental Update Logic**
   - fetch only new or changed stories when possible
   - use fingerprinting/hashes to skip reprocessing
   - avoid re-normalizing identical items repeatedly

4. **Smart Cache Strategy**
   - cache raw source responses briefly
   - cache normalized stories
   - use stale-while-revalidate where helpful
   - use fast fallback responses from recent good cache
   - keep feed fast even if some source refreshes are still running

5. **Scheduling Strategy**
   - design for frequent refreshes
   - support polling intervals based on source priority
   - if cron or scheduled jobs are needed, wire them cleanly for Vercel
   - if webhooks are possible for certain providers, design for them

6. **Fallback Behavior**
   - if a live source fetch fails, serve latest good cached stories
   - persist fetch errors for diagnostics without breaking UX

7. **Performance Discipline**
   - avoid sequential loops when concurrency is safe
   - trim unnecessary payload fields
   - minimize parsing overhead
   - keep dependencies lean

Important:
Plan to get sources together in real time and as fast as possible while staying realistic and production-safe.

---

# Phase 4: Add Strong Deduplication and Story Merging
Build deduplication so the feed feels clean, not noisy.

## Implement Deduplication Using
- URL normalization
- canonical URL detection
- content fingerprinting
- fuzzy title matching where useful
- publish-time proximity logic
- source-priority rules for choosing canonical stories

## Support
- canonical story selection
- alternate source list
- merged cluster for same story across outlets
- source badges in UI
- optional “also reported by” behavior

The result should prevent source spam while still preserving source diversity.

---

# Phase 5: Upgrade Sources into a Real Product Feature
The Sources section must become a meaningful user-facing control layer.

## Implement a Proper Sources Experience
Create a real Sources page, panel, or control system showing:
- active sources
- source metadata
- last refreshed time
- fetch status
- category coverage
- language coverage
- region coverage
- source credibility or priority if applicable
- source logos/icons where appropriate

## Connect Sources to the Feed
Implement:
- filter feed by source
- optional multi-source selection
- source badges on stories
- source-aware feed rendering
- clean empty states and degraded states

## Refresh Behavior
- refresh feed quickly without clunky full reloads
- keep UX smooth and compact
- polished loading and skeleton states
- preserve user filters during refresh

## Error and Empty States
Handle:
- source temporarily failing
- source active but empty
- no filters matching
- partial source availability

Keep the UI elegant, compact, responsive, and easy to understand.

---

# Phase 6: Nepali and English Content Excellence
Make Nepali and English work elegantly across the platform.

## Requirements
- ingest stories in original language
- preserve original metadata
- support Nepali and English cleanly
- if EN → NP exists, integrate it into the new source flow
- if it does not exist, structure it properly
- translation must not block feed freshness
- cache translated output
- translate selectively where useful
- title and summary translation should be fast and clean
- typography must be optimized for both Nepali and English
- date/time formatting should feel natural for the product
- content hierarchy should remain readable in both languages

## Important
Do not let translation become the bottleneck.
Feed freshness comes first.

---

# Phase 7: Theme Overhaul and Reading Experience
Perform a full theme and reading-experience overhaul for premium readability.

## Goals
- perfect readability in both light and dark themes
- comfortable reading modes
- visually premium but not noisy
- intuitive and emotionally trustworthy UI
- modern and sellable product feel

## Implement
- improved typography scale
- better spacing and visual hierarchy
- stronger contrast handling
- theme switcher if not already solid
- light/dark theme polish across the app
- reading-focused card and article presentation
- comfortable reading modes if appropriate
- better surfaces, borders, shadows, and depth discipline
- premium but restrained visual system
- intuitive interaction states
- cleaner navbar, sidebar, and filter behavior
- responsive behavior across mobile, tablet, and desktop

## UX Standard
The UI should feel top notch, user intuitive, elegant, premium, and not complex.
It should be easy to scan and satisfying to read.

---

# Phase 8: Performance-First Engineering
Treat performance as a hard requirement.

## Optimize
- server-side fetch paths
- API route latency
- route revalidation strategy
- bundle size
- hydration load
- client state usage
- repeated fetches
- rerender hotspots
- oversized story payloads
- source loading latency
- image handling where relevant

## Add Where Useful
- streaming or partial rendering
- route-level caching
- revalidation policies
- lazy loading
- selective hydration
- compact loading states
- image optimization

## Performance Targets
- fast first load
- fast feed refresh
- low latency source updates
- lightweight production build on Vercel
- smooth interaction across device sizes

---

# Phase 9: SEO, Accessibility, and Reliability Hardening
While implementing the system, harden the product properly.

## SEO
- strong metadata
- canonical handling
- structured news-friendly metadata where useful
- source and story discoverability
- sitemap sanity
- robots sanity
- share metadata quality

## Accessibility
- keyboard-safe navigation and filters
- proper labels and semantics
- accessible loading states
- color contrast correctness
- focus visibility
- screen-reader clarity
- responsive tap targets

## Reliability
- logging
- error boundaries
- source fetch diagnostics
- fallback behavior
- monitoring hooks where appropriate
- safe failures that do not break the whole feed

---

# Phase 10: Testing and Validation
Add practical tests and validation for the important parts.

## Test Coverage
- source normalization
- failed source fetch handling
- cache behavior
- deduplication logic
- story merge behavior
- filter logic
- translation boundaries
- theme behavior where sensible
- source-aware rendering behavior

## Validate
- mobile layout is not broken
- no demo leftovers remain
- no dead files remain
- no stale code paths remain
- no unused source adapters remain
- no broken navigation or filters
- no visual regressions in readability

---

# Phase 11: Cleanup and Documentation
After implementation:
1. remove redundant code, dead utilities, stale mocks, and unused files
2. keep naming consistent
3. make source extension simple for future additions
4. update README properly

## README Must Include
- architecture overview
- source registry and ingestion flow
- normalization pipeline
- deduplication strategy
- caching and revalidation strategy
- translation flow
- theme/readability system overview if relevant
- local setup
- deployment notes
- how real-time or near-real-time updates work
- how to add a new source
- known tradeoffs

---

# Source Expansion Requirement
For every source currently mentioned in the project, include it properly in the architecture and UI. If major relevant sources are missing, add them too where technically and legally appropriate.

Prioritize clean feed/API/RSS integrations over brittle scraping.
If a source is unsuitable, document why and provide the next best production-safe alternative.

---

# Final Deliverable Format
At the end, provide exactly these sections:

## 1. What Was Built
A precise summary of the implemented features.

## 2. Architecture
Explain clearly:
- source registry
- ingestion flow
- normalization
- deduplication
- caching
- translation
- frontend integration
- theme/readability strategy

## 3. File-by-File Changes
List important files created, updated, removed.

## 4. Performance Decisions
Explain exactly what was done to make source fetching fast and near real time.

## 5. UI and UX Decisions
Explain what was changed to make the platform elegant, intuitive, readable, premium, and not complex.

## 6. Remaining Recommendations
Only include genuinely useful next steps.

## 7. Updated README
Provide a production-quality README.

---

# Execution Start
Now begin by:
1. auditing the existing project
2. locating Sources, feed flow, filters, and theme system
3. identifying current blockers
4. producing the implementation plan
5. then executing the phases in order

Remember:
- prioritize real-time source aggregation speed
- prioritize perceived speed and actual speed
- prioritize elegant Nepali and English reading experience
- prioritize a premium but simple UI
- keep the build lean and production-ready
