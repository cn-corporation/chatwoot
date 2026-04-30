# Mobile UX pass — live chats

**Date:** 2026-04-30
**Branch:** `feature/mobile-ui-enhancements`
**Scope:** Make the Chatwoot operator dashboard usable on phones (~360–430 px portrait). Live chats only in this pass — admin / settings / reports follow later.
**Breakpoint:** 768 px (existing `SMALL_SCREEN_BREAKPOINT`).

## Context

Chatwoot is desktop-first. The current `feature/mobile-ui-enhancements` branch already has scaffolding (off-canvas `Sidebar`, `MobileSidebarLauncher`, single-pane mobile branch in `ConversationView`), but live testing at 390 × 844 reveals blocking flow bugs and broken layouts inside the conversation view itself.

## Pain points (verified live)

| # | Severity | Issue | Where |
|---|---|---|---|
| 1 | Blocker | Tapping a conversation lands on the **Contact panel**, not the chat. `setActiveChat` auto-sets `is_contact_sidebar_open: true`, and on mobile the contact panel replaces the message view in the v-show chain. | `routes/dashboard/conversation/ConversationView.vue` (`setActiveChat`, `showMessageView`, `shouldShowSidebar`) |
| 2 | Blocker | No way back from the Contact panel on mobile — no header, no back button. | `components/widgets/conversation/ConversationSidebar.vue` + `ContactPanel.vue` |
| 3 | Blocker | Send button clipped off-screen in `ReplyBox` bottom toolbar (emoji + attach + mic + signature + AI + Send all on one row). | `components/widgets/conversation/ReplyBox.vue` |
| 4 | High | Reply mode tabs ("Reply / Private note / Task / Translate") wrap, "Личная заметка" breaks to two lines. | `ReplyBox.vue` (mode tabs) |
| 5 | High | `ConversationHeader` is `h-24` on mobile (~12 % of viewport). Actions stack below avatar. | `components/widgets/conversation/ConversationHeader.vue:100` |
| 6 | Medium | Floating sidebar launcher at `bottom-4 left-4` overlaps chat list scrollbar; ignores iOS `safe-area-inset-bottom`. | `components-next/sidebar/MobileSidebarLauncher.vue` |
| 7 | Medium | `ChatListHeader` icon buttons (`text-xs`, sub-32 px) are below the 44 px tap-target guideline. | `ChatListHeader.vue` |
| 8 | Medium | "View translated" is a plain-text link inside message bubbles, not a tap-target. | `components-next/message/...` |
| 9 | Low | ChatTypeTabs scroll-arrows overlap content. | `ChatList.vue` |
| 10 | Low | Layout uses `100vh`/`h-full`; iOS keyboard pushes ReplyBox off-screen. | global / root layout |

## Non-goals

- Settings / reports / help-center mobile (next pass).
- Tablet (768–1024 px) tuning.
- Native PWA install / push.
- Re-platforming `ReplyBox` (still 49 KB; we trim mobile chrome around it but don't decompose).

## Architecture decisions

- Stay with the existing 768 px breakpoint (`wootConstants.SMALL_SCREEN_BREAKPOINT`).
- Introduce one shared composable, `useIsMobile()`, wrapping `@vueuse/core`'s `useWindowSize` and replacing the duplicated `windowWidth < SMALL_SCREEN_BREAKPOINT` checks in `Dashboard.vue`, `ConversationView.vue`, `ConversationBox.vue`, `ConversationHeader.vue`. Single source of truth, fewer drift bugs.
- Tailwind only — no scoped or custom CSS (per `CLAUDE.md`).
- No new runtime deps for sections A–F. Section G optionally adds a gesture lib.
- Mobile gets a **3-step navigation stack**: `Chat list → Chat → Contact panel`. Each is full-width; the user moves between them with explicit back / open buttons. The desktop split-pane stays untouched.
- `dvh` (dynamic viewport) replaces `vh`/`100%` on full-height mobile containers so the iOS keyboard resizes the layout instead of pushing the input off-screen.

## Sections

Each section is independently shippable. Order is by user impact: A → C unlock the feature; D → G polish.

### A — Conversation navigation flow (fixes #1, #2)

- `ConversationView.vue` mobile branch:
  - `showMessageView` = `!!conversationId` (drop the `&& !shouldShowSidebar` clause).
  - On mobile, `shouldShowSidebar` controls a *separate overlay* on top of the message view, not a sibling that replaces it.
- `setActiveChat` no longer toggles `is_contact_sidebar_open: true` on mobile. It stays whatever the user last chose (defaults to closed on mobile).
- Mobile contact panel gets its own back-arrow header that closes the overlay (animation: slide-in from right).
- Tapping the avatar / name in `ConversationHeader` opens the contact panel on mobile.

### B — `ConversationHeader` compaction (fix #5)

- Always single row, `h-12`.
- Mobile layout: `[← back] [avatar 28 px] [name truncate] [⋯ MoreActions]`.
- On `< md`, move `OperatorPresenceDropdown`, `WaitingToggle`, and the SLA label into `MoreActions`.
- Name + avatar area is tappable → opens contact panel (replaces an explicit "ⓘ" button).

### C — `ReplyBox` mobile layout (fixes #3, #4)

- Mode tabs become a horizontal scroll-strip: `flex overflow-x-auto whitespace-nowrap snap-x` on `< md`.
- Bottom toolbar splits into two rows on `< sm`:
  - Row 1: format toolbar (B / I / list / link) — unchanged.
  - Row 2 left cluster: emoji · attach · mic · signature · AI.
  - Row 2 right: **Send** as a fixed primary icon button (`i-lucide-send`), `min-w-12`, `flex-shrink-0`. Never clips.
- Editor body: `min-h-[88px] max-h-[40dvh]` — caps the editor so it can't swallow the screen.

### D — Mobile-safe layout primitives (fixes #6, #10)

- Replace `h-full` / `100vh` on the root layout containers with `h-dvh`.
- `MobileSidebarLauncher`:
  - Moves into `ChatListHeader` as a regular menu button (no longer floats) — fewer overlap bugs, more discoverable.
  - The float remains only on screens that don't have their own header (the dashboard fallback).
  - When floating: `bottom: max(1rem, env(safe-area-inset-bottom))`.

### E — `ChatList` mobile polish (fixes #7, #9)

- `ChatListHeader` icon buttons → `h-10 w-10` minimum on `< md`.
- `ChatTypeTabs`: scroll arrows hidden on touch devices (`@media (pointer: coarse)`); native swipe handles it. Edge fade gradient indicates more content.
- Conversation row: avatar bump to 40 px on `< md`, add `active:scale-[0.99]` press feedback.

### F — Tap-target audit (fix #8)

- Sweep `components-next/message/**` and message bubble action buttons; anything < 36 px gets bumped to `min-h-9 min-w-9` on `< md`.
- "View translated" plain text → ghost-style button (`min-h-8`, `px-2`, subtle background on press).

### G — Gestures (nice-to-have, last)

- Swipe right on chat → back to list.
- Optional dependency: `@vueuse/gesture`. If we ship without it, A–F still cover the core experience.

## Testing

- Manual via Playwright at 390 × 844 (iPhone 14) and 360 × 800 (small Android). Capture before/after screenshots for each section into `.playwright-mcp/`.
- Smoke checks: open a conversation → see chat (not contact panel), send a message (Send button visible), open contact panel (back button works), open sidebar (no overlap with reply input).
- Existing JS / Ruby tests must keep passing. No new specs required (per `CLAUDE.md`'s "avoid writing specs unless explicitly asked").

## Translations

- Any new strings (e.g. a "Contact" header label, mobile-specific tooltips) added in lockstep to `en.json` and `ru.json` (per `CLAUDE.md`).

## Out of scope / follow-ups

- Tablet 768–1024 layout polish.
- Settings, reports, help-center mobile.
- PWA install / push notifications.
- Native gesture library if section G is dropped.
