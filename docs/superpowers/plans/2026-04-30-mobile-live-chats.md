# Mobile UX Pass — Live Chats — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Chatwoot operator dashboard usable on phones (~390 px portrait) for the live-chat flow: chat list → chat → contact panel, with a working `ReplyBox`, compact header, and mobile-safe layout primitives.

**Architecture:** Keep the desktop split-pane untouched. On mobile (< 768 px) the dashboard becomes a 3-step navigation stack — `ChatList → Chat → Contact panel` — each full-width. A single `useIsMobile()` composable replaces the duplicated `windowWidth < SMALL_SCREEN_BREAKPOINT` checks. `ReplyBox` mode tabs scroll horizontally; bottom-toolbar wraps with a fixed Send. iOS-safe layout uses `dvh` units and `safe-area-inset-bottom`.

**Tech Stack:** Vue 3 Composition API (`<script setup>`), Tailwind utility classes only, `@vueuse/core` for `useWindowSize`, existing `vuex` store and `useUISettings` composable, Playwright for verification at 390 × 844.

**Spec:** `docs/superpowers/specs/2026-04-30-mobile-live-chats-design.md`

---

## File Map

**Create:**
- `app/javascript/dashboard/composables/useIsMobile.js` — single mobile-breakpoint composable.

**Modify:**
- `app/javascript/dashboard/routes/dashboard/conversation/ConversationView.vue` — fix the mobile show-message-view logic; stop auto-opening the contact sidebar on mobile.
- `app/javascript/dashboard/components/widgets/conversation/ConversationSidebar.vue` — render a back-arrow header on mobile.
- `app/javascript/dashboard/components/widgets/conversation/ConversationHeader.vue` — single-row header on every viewport; tappable name area opens contact panel; collapse extra controls into MoreActions on mobile.
- `app/javascript/dashboard/components/widgets/conversation/ConversationBox.vue` — use `useIsMobile`.
- `app/javascript/dashboard/routes/dashboard/Dashboard.vue` — use `useIsMobile`.
- `app/javascript/dashboard/components/widgets/WootWriter/ReplyTopPanel.vue` — horizontal scroll-strip mode tabs.
- `app/javascript/dashboard/components/widgets/WootWriter/ReplyBottomPanel.vue` — wrap on mobile, send button never clips.
- `app/javascript/dashboard/components-next/sidebar/MobileSidebarLauncher.vue` — safe-area inset.
- `app/javascript/dashboard/components/ChatListHeader.vue` — bumped tap targets.
- `app/javascript/dashboard/i18n/locale/en.json` & `ru.json` — new strings.

**Verify only:**
- Playwright at 390 × 844 — see Verify steps.

---

## Conventions

- All section commits use Conventional Commits format with scope `mobile`, e.g. `feat(mobile): single-row conversation header`.
- After every code change, run the linter (`pnpm eslint:fix path/to/file`) before committing.
- Take a Playwright before/after screenshot for each blocker fix and store under `.playwright-mcp/` (gitignored).
- Don't add specs (per `CLAUDE.md`).

---

## Section A — Conversation navigation flow (fixes blockers #1, #2)

**Goal:** Tapping a conversation on mobile shows the chat. Contact panel opens only on explicit user action, with a back button.

### Task A1: Add `useIsMobile()` composable

**Files:**
- Create: `app/javascript/dashboard/composables/useIsMobile.js`

- [ ] **Step 1: Create the composable**

```js
import { computed } from 'vue';
import { useWindowSize } from '@vueuse/core';
import wootConstants from 'dashboard/constants/globals';

export function useIsMobile() {
  const { width } = useWindowSize();
  const isMobile = computed(
    () => width.value < wootConstants.SMALL_SCREEN_BREAKPOINT
  );
  return { isMobile, width };
}
```

- [ ] **Step 2: Lint**

Run: `pnpm eslint:fix app/javascript/dashboard/composables/useIsMobile.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/javascript/dashboard/composables/useIsMobile.js
git commit -m "feat(mobile): add useIsMobile composable"
```

### Task A2: Fix `ConversationView` mobile show-logic & stop auto-opening contact sidebar

**Files:**
- Modify: `app/javascript/dashboard/routes/dashboard/conversation/ConversationView.vue`

- [ ] **Step 1: Replace `showMessageView` mobile branch and `setActiveChat` ui-settings update**

In `ConversationView.vue`, replace the `showMessageView` computed:

```js
showMessageView() {
  if (this.isMobileView) {
    return !!this.conversationId;
  }
  return this.conversationId ? true : !this.isOnExpandedLayout;
},
```

And in `setActiveChat()` (around line 218), wrap the `is_contact_sidebar_open: true` setting so it only fires on desktop:

```js
.then(() => {
  emitter.emit(BUS_EVENTS.SCROLL_TO_MESSAGE, { messageId });
  if (!this.isMobileView) {
    this.updateUISettings({
      is_contact_sidebar_open: true,
      is_copilot_panel_open: false,
    });
  }
});
```

- [ ] **Step 2: Verify with Playwright**

Open `/app/accounts/1/conversations/29` at 390 × 844. Expected: message view (not contact panel) is rendered, ReplyBox is visible. Take screenshot `.playwright-mcp/A2-after.jpg`.

- [ ] **Step 3: Lint & commit**

Run: `pnpm eslint:fix app/javascript/dashboard/routes/dashboard/conversation/ConversationView.vue`

```bash
git add app/javascript/dashboard/routes/dashboard/conversation/ConversationView.vue
git commit -m "fix(mobile): show chat instead of contact panel on conversation tap"
```

### Task A3: Add back-arrow header to mobile contact panel overlay

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationSidebar.vue`
- Modify: `app/javascript/dashboard/i18n/locale/en.json`
- Modify: `app/javascript/dashboard/i18n/locale/ru.json`

- [ ] **Step 1: Add i18n keys**

In `en.json`, under `CONVERSATION` (preserve existing structure), add:

```json
"CONTACT_PANEL_HEADER": "Contact",
"CLOSE_CONTACT_PANEL": "Close contact details"
```

In `ru.json`, the matching keys:

```json
"CONTACT_PANEL_HEADER": "Контакт",
"CLOSE_CONTACT_PANEL": "Закрыть данные контакта"
```

- [ ] **Step 2: Render the header on mobile**

Replace the `<template>` in `ConversationSidebar.vue` with:

```vue
<template>
  <div
    v-on-click-outside="() => closeContactPanel()"
    class="bg-n-background h-full overflow-visible flex flex-col fixed top-0 z-40 w-full max-w-sm transition-transform duration-300 ease-in-out ltr:right-0 rtl:left-0 md:static md:w-full md:max-w-none ltr:border-l rtl:border-r border-n-weak shadow-lg md:shadow-none"
    :class="[
      {
        'md:flex': activeTab === 0,
        'md:hidden': activeTab !== 0,
      },
    ]"
  >
    <div
      v-if="isSmallScreen"
      class="flex items-center gap-2 h-12 px-2 border-b border-n-weak flex-shrink-0"
    >
      <button
        type="button"
        class="flex items-center justify-center h-10 w-10 rounded-lg text-n-slate-12 hover:bg-n-alpha-2"
        :aria-label="$t('CONVERSATION.CLOSE_CONTACT_PANEL')"
        @click="closeContactPanel"
      >
        <span class="i-lucide-arrow-left size-5" />
      </button>
      <span class="text-sm font-medium text-n-slate-12 truncate">
        {{ $t('CONVERSATION.CONTACT_PANEL_HEADER') }}
      </span>
    </div>
    <div
      class="flex flex-1 overflow-x-visible overflow-y-auto relative z-[100]"
    >
      <ContactPanel
        v-show="activeTab === 0"
        :conversation-id="currentChat.id"
        :inbox-id="currentChat.inbox_id"
      />
    </div>
  </div>
</template>
```

Also update `closeContactPanel` to also work when not specifically small-screen (still safe to call):

```js
const closeContactPanel = () => {
  updateUISettings({
    is_contact_sidebar_open: false,
    is_copilot_panel_open: false,
  });
};
```

- [ ] **Step 3: Verify with Playwright**

At 390 × 844, open a conversation, tap the avatar/name area in the conversation header (or call the store action via console: `__vue_app__.config.globalProperties.$store.dispatch('updateUISettings', {uiSettings:{is_contact_sidebar_open: true}})`). Expected: contact overlay slides in with a back arrow at top-left; tapping the arrow closes it.

- [ ] **Step 4: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components/widgets/conversation/ConversationSidebar.vue
git add app/javascript/dashboard/components/widgets/conversation/ConversationSidebar.vue \
        app/javascript/dashboard/i18n/locale/en.json \
        app/javascript/dashboard/i18n/locale/ru.json
git commit -m "feat(mobile): add back-arrow header to contact panel overlay"
```

---

## Section B — `ConversationHeader` compaction (fix #5)

### Task B1: Single-row header always; collapse mobile extras into MoreActions

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/conversation/ConversationHeader.vue`

- [ ] **Step 1: Make header single-row & tappable name area**

Replace the existing `<template>` block in `ConversationHeader.vue` with:

```vue
<template>
  <div
    ref="conversationHeader"
    class="flex flex-row items-center justify-between flex-1 w-full min-w-0 gap-2 px-3 py-2 border-b bg-n-background border-n-weak h-12"
  >
    <button
      type="button"
      class="flex items-center min-w-0 flex-1 gap-2 text-left rounded-lg active:bg-n-alpha-2 md:cursor-default"
      :aria-label="$t('CONVERSATION.OPEN_CONTACT_PANEL')"
      @click="openContactPanelOnMobile"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="ltr:mr-1 rtl:ml-1 flex-shrink-0"
      />
      <Avatar
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="32"
        :status="currentContact.availability_status"
        hide-offline-status
        rounded-full
      />
      <div class="flex flex-col items-start min-w-0 overflow-hidden">
        <div class="flex flex-row items-center max-w-full gap-1">
          <span class="text-sm font-medium truncate leading-tight text-n-slate-12">
            {{ currentContact.name }}
          </span>
          <fluent-icon
            v-if="!isHMACVerified"
            v-tooltip="$t('CONVERSATION.UNVERIFIED_SESSION')"
            size="14"
            class="text-n-amber-10 my-0 mx-0 min-w-[14px] flex-shrink-0"
            icon="warning"
          />
        </div>
        <div
          class="flex items-center gap-2 overflow-hidden text-xs conversation--header--actions text-ellipsis whitespace-nowrap"
        >
          <InboxName v-if="hasMultipleInboxes" :inbox="inbox" class="!mx-0" />
          <span v-if="isSnoozed" class="font-medium text-n-amber-10">
            {{ snoozedDisplayText }}
          </span>
        </div>
      </div>
    </button>
    <div
      class="flex flex-row items-center justify-end flex-shrink-0 gap-1 header-actions-wrap"
    >
      <SLACardLabel
        v-if="hasSlaPolicyId"
        :chat="chat"
        show-extended-info
        :parent-width="width"
        class="hidden md:flex"
      />
      <OperatorPresenceDropdown
        v-if="currentChat.id"
        :conversation-id="currentChat.id"
        class="hidden md:flex"
      />
      <WaitingToggle v-if="currentChat.id" class="hidden md:flex" />
      <MoreActions :conversation-id="currentChat.id" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add the `openContactPanelOnMobile` method to `<script setup>`**

In `ConversationHeader.vue`, after the existing imports, add:

```js
import { useIsMobile } from 'dashboard/composables/useIsMobile';
import { useUISettings } from 'dashboard/composables/useUISettings';

// ...existing setup code...

const { isMobile } = useIsMobile();
const { updateUISettings } = useUISettings();

const openContactPanelOnMobile = () => {
  if (!isMobile.value) return;
  updateUISettings({ is_contact_sidebar_open: true });
};
```

- [ ] **Step 3: Add i18n keys**

`en.json` under `CONVERSATION`:
```json
"OPEN_CONTACT_PANEL": "Open contact details"
```
`ru.json`:
```json
"OPEN_CONTACT_PANEL": "Открыть данные контакта"
```

- [ ] **Step 4: Verify with Playwright**

At 390 × 844 on a conversation: header is one row tall (~48 px). Tapping name/avatar opens the contact overlay (from Task A3). The `MoreActions` button (⋯) is visible.

- [ ] **Step 5: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components/widgets/conversation/ConversationHeader.vue
git add app/javascript/dashboard/components/widgets/conversation/ConversationHeader.vue \
        app/javascript/dashboard/i18n/locale/en.json \
        app/javascript/dashboard/i18n/locale/ru.json
git commit -m "feat(mobile): compact single-row conversation header"
```

> Note: This task hides `OperatorPresenceDropdown` and `WaitingToggle` on mobile via `hidden md:flex`. Since `MoreActions.vue` is already a 514 B placeholder, exposing those actions inside MoreActions is **deferred** — the user can still reach them on tablet/desktop. If a follow-up is needed, file an issue. (YAGNI — operators on mobile rarely flip presence; the back-button to list and Send-message are the critical paths.)

---

## Section C — `ReplyBox` mobile (fixes blockers #3, #4)

### Task C1: Mode tabs become a horizontal scroll strip

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/WootWriter/ReplyTopPanel.vue`

- [ ] **Step 1: Wrap `EditorModeToggle` in a scroll-strip container**

Replace the `<template>` block with:

```vue
<template>
  <div class="flex justify-between items-center gap-2 ltr:pl-3 rtl:pr-3 min-h-[3.25rem]">
    <div class="flex-1 min-w-0 overflow-x-auto no-scrollbar">
      <EditorModeToggle
        :mode="mode"
        class="mt-3 whitespace-nowrap"
        @select-mode="handleSelectMode"
      />
    </div>
    <div class="flex items-center mx-4 my-0 flex-shrink-0">
      <div v-if="isMessageLengthReachingThreshold" class="text-xs">
        <span :class="charLengthClass">
          {{ characterLengthWarning }}
        </span>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify with Playwright**

At 390 × 844 in a conversation: mode tabs are on a single row, scrollable horizontally if they overflow; nothing wraps to a second line.

- [ ] **Step 3: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components/widgets/WootWriter/ReplyTopPanel.vue
git add app/javascript/dashboard/components/widgets/WootWriter/ReplyTopPanel.vue
git commit -m "fix(mobile): keep reply mode tabs on a single scrollable row"
```

### Task C2: ReplyBottomPanel — Send button never clips, allow toolbar wrap on mobile

**Files:**
- Modify: `app/javascript/dashboard/components/widgets/WootWriter/ReplyBottomPanel.vue`

- [ ] **Step 1: Allow the row to wrap on mobile and force Send onto the right edge**

In `ReplyBottomPanel.vue`'s `<template>`, change the outer wrapper and the `right-wrap` behavior:

```vue
<template>
  <div
    class="flex flex-wrap items-center justify-between gap-y-2 p-3 sm:flex-nowrap"
    :class="wrapClass"
  >
    <div class="left-wrap flex-wrap sm:flex-nowrap">
      <!-- ...all existing left-cluster buttons unchanged... -->
    </div>
    <div class="right-wrap ltr:ml-auto rtl:mr-auto">
      <NextButton
        :label="sendButtonText"
        type="submit"
        sm
        :color="isNote ? 'amber' : 'blue'"
        :disabled="isSendDisabled"
        class="flex-shrink-0 min-w-[5rem]"
        @click="onSend"
      />
    </div>
  </div>
</template>
```

(Leave the inner button list — emoji, attach, mic, signature, AI, etc. — untouched. Only the outer flex wrapper and `right-wrap` get tweaked.)

Also update the scoped style: `.left-wrap` already uses `flex` `gap-2`; on mobile it should wrap. Replace the `<style>` block:

```vue
<style lang="scss" scoped>
.left-wrap {
  @apply items-center flex gap-2;
}

.right-wrap {
  @apply flex;
}

::v-deep .file-uploads {
  label {
    @apply cursor-pointer;
  }

  &:hover button {
    @apply enabled:bg-n-slate-9/20;
  }
}
</style>
```

(The `flex-wrap` is now applied via the template class on the outer div; the inner `left-wrap` keeps its non-wrapping flex so the buttons themselves don't break.)

- [ ] **Step 2: Verify with Playwright**

At 390 × 844 with a conversation open: Send button is fully visible on the right edge of the screen; emoji/attach/mic/signature/AI cluster sits on its own row above when there's no horizontal room. No clipping.

- [ ] **Step 3: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components/widgets/WootWriter/ReplyBottomPanel.vue
git add app/javascript/dashboard/components/widgets/WootWriter/ReplyBottomPanel.vue
git commit -m "fix(mobile): wrap reply bottom toolbar so Send button never clips"
```

---

## Section D — Mobile-safe layout primitives (fixes #6, #10)

### Task D1: `dvh` on root layout containers

**Files:**
- Modify: `app/javascript/dashboard/routes/dashboard/Dashboard.vue`

- [ ] **Step 1: Switch root container to `h-dvh` on mobile**

In `Dashboard.vue`, replace the root `<div>` opening tag:

```vue
<div class="flex flex-grow overflow-hidden text-n-slate-12 h-dvh md:h-auto">
```

(On desktop the parent already constrains height; on mobile we want the iOS dynamic viewport so the on-screen keyboard reduces, instead of pushes, the layout.)

- [ ] **Step 2: Verify with Playwright**

At 390 × 844 with a conversation open: focus the message editor (no real iOS keyboard available in headless, but the layout should still render exactly the same — `h-dvh` falls back to `vh` where dvh isn't supported, but every modern browser supports it).

- [ ] **Step 3: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/routes/dashboard/Dashboard.vue
git add app/javascript/dashboard/routes/dashboard/Dashboard.vue
git commit -m "feat(mobile): use h-dvh on dashboard root for keyboard-safe layout"
```

### Task D2: Mobile sidebar launcher honors safe-area-inset-bottom

**Files:**
- Modify: `app/javascript/dashboard/components-next/sidebar/MobileSidebarLauncher.vue`

- [ ] **Step 1: Use `bottom-[max(1rem,env(safe-area-inset-bottom))]`**

Replace the wrapper class in `MobileSidebarLauncher.vue`:

```vue
<div
  v-if="!isConversationRoute"
  id="mobile-sidebar-launcher"
  class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] ltr:left-4 rtl:right-4 z-40 transition-transform duration-200 ease-in-out block md:hidden"
  :class="[
    {
      'ltr:translate-x-48 rtl:-translate-x-48': isMobileSidebarOpen,
    },
  ]"
>
```

- [ ] **Step 2: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components-next/sidebar/MobileSidebarLauncher.vue
git add app/javascript/dashboard/components-next/sidebar/MobileSidebarLauncher.vue
git commit -m "fix(mobile): respect safe-area-inset-bottom for sidebar launcher"
```

---

## Section E — `ChatList` mobile polish (fix #7)

### Task E1: Bump tap targets in `ChatListHeader`

**Files:**
- Modify: `app/javascript/dashboard/components/ChatListHeader.vue`

- [ ] **Step 1: Identify all `<NextButton>` instances in `ChatListHeader.vue`**

Run: `grep -n "<NextButton" app/javascript/dashboard/components/ChatListHeader.vue`

Read each match in context. Each occurrence is a header icon button (filter, sort, bulk-actions, toggles).

- [ ] **Step 2: Bump every `<NextButton>` in this file from `sm` to responsive size**

For each `<NextButton>` line in `ChatListHeader.vue`, replace the `sm` prop with the responsive class that uses 40 × 40 on mobile and the existing 32 × 32 on desktop:

```diff
- <NextButton ... sm ... />
+ <NextButton ... sm class="!h-10 !w-10 md:!h-8 md:!w-8" ... />
```

Apply the same `class` attribute to every `<NextButton>` in this file. If a button already has a `class="..."`, append the new utilities (don't replace the existing ones).

- [ ] **Step 3: Verify with Playwright**

At 390 × 844 on the dashboard: chat list header buttons are at least 40 × 40 px; layout still fits.

- [ ] **Step 4: Lint & commit**

```bash
pnpm eslint:fix app/javascript/dashboard/components/ChatListHeader.vue
git add app/javascript/dashboard/components/ChatListHeader.vue
git commit -m "fix(mobile): bump chat list header tap targets to 40px"
```

---

## Section F — Final verify

### Task F1: Full Playwright sweep

- [ ] **Step 1: Run Chatwoot at 390 × 844, walk the user flow**

1. Login as `john@acme.inc` / `Password1!`.
2. From dashboard: tap a conversation row → expect chat view (not contact panel).
3. ReplyBox visible: mode tabs scroll, Send button visible at the right edge, no two-line tab break.
4. Tap conversation header avatar/name → contact overlay slides in with back arrow.
5. Tap back arrow → returns to chat.
6. Tap header back-arrow (`BackButton`) → returns to chat list.
7. Tap floating sidebar launcher (chat-list view only) → app sidebar slides in.

- [ ] **Step 2: Capture before/after screenshots**

Save each screen to `.playwright-mcp/F1-after-<step>.jpg` for the design-doc archive.

- [ ] **Step 3: Run lint suite**

Run: `pnpm eslint app/javascript/dashboard`
Expected: no errors.

- [ ] **Step 4: Commit screenshots reference (optional)**

If `.playwright-mcp/` is gitignored, skip this step. Otherwise no commit needed.

---

## Out of scope (tracked for follow-ups)

- Section G of the spec (gestures) — defer.
- Tablet (768–1024 px) tuning.
- Settings, reports, help-center mobile.
- Decomposing `ReplyBox.vue` (49 KB) — out of scope; we only adjust toolbar layout.
- Surface `OperatorPresenceDropdown` and `WaitingToggle` inside `MoreActions` on mobile — deferred to a follow-up if operators report needing them on mobile (YAGNI).
