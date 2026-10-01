# Retention space: implementation and verification plan

Status: target implementation and verification plan. Membership, the native Telegram workspace, sessions, snapshots and integration guards are now implemented. [Implementation status](implementation-status.md) is the authoritative description of current behavior; the milestones below also include future hardening.

## Implemented membership settings

Administrators can select users at **Settings → Account settings → Retention specialists**, immediately below Assignable agents. The searchable multiselect has an explicit **Save specialists** button and restores the saved selection on reload. English and Russian copy is included.

The selector uses authenticated `GET` and `PUT /api/v1/accounts/:account_id/retention/members`. Membership is persisted on `account_users.retention_member`, defaults to false, and is limited to verified users of the current account. Updating it preserves support roles and availability. A revision check rejects stale saves instead of overwriting another administrator's selection. Enterprise audit records include membership changes.

Deploy both updated repositories and apply all three retention migrations described in [implementation status](implementation-status.md). Saving membership reveals the workspace to those users. A conversation enters retention when its first specialist retention message or an exact `/start rtn` bot launch is accepted.

Verification: migration applied to a disposable local PostgreSQL database; 29 request/model examples passed, including the new membership API and existing account settings/account-user behavior; 5 frontend tests passed for saved selection, explicit save, failures, conflicts and account-switch response ordering. Targeted Ruby/JavaScript lint and diff checks are part of the final review.

The following sections remain the target production plan, including mechanisms not yet implemented. Read the [system design](design.md) and the [Extra integration contract](../../../chatwoot-extra/docs/retention-space/integration-contract.md) first. Deliver the feature in reviewable changes with new starts disabled until the shared acceptance gates pass. The plan assumes the proposed product defaults in the design; capture any review changes before coding.

## 1. Repository ownership

| Responsibility | Chatwoot | chatwoot-extra |
| --- | --- | --- |
| Member administration, role checks | Canonical database and policy | Trust only authenticated server claims where needed |
| Retention search/live workspace | Vue routes, Rails API, existing messaging adapter | Protect alternate access paths |
| Session transitions and message scope | Canonical transaction/epoch/locks | Enforce consumer and worker guards |
| Immutable session snapshot | Build exact session transcript; store UUID/digest receipt; authorize browser access | Canonical immutable payload, indexed history, original media metadata and future bulk analysis |
| Support exclusion | Queries, policy, callbacks, jobs, reports, realtime | Dispatcher, direct APIs, queues, exports, external sends |
| Lifecycle delivery | Durable outbox | Durable inbox, ordered projection, cleanup/reconciliation |
| Direct automated Telegram delivery | Authoritative admission and dispatch boundary | Route enabled targets through that boundary |

Do not move unrelated source-channel, macro, payroll, or support-report configuration as part of this feature. Refactor only the boundaries that are needed for isolation and verify legacy behavior there.

## 2. Phase A: establish the contract and inventory

Deliverables:

- Finalize member/access, takeover, archive visibility, transcript extent, and supported-channel defaults from the design.
- Check actual deployment configuration for all webhook subscribers, Sidekiq/RabbitMQ workers, scheduled processes, bot integrations, Telegram senders, object storage lifecycle/purge rules, and external tracking consumers. Do not infer that only in-repository consumers exist.
- Confirm Telegram routing identity. The current incoming service selects `contact_inbox.conversations.first`, while `ContactInbox#current_conversation` selects `.last`. Use the existing incoming destination as the v1 canonical retention candidate; share an explicit resolver between search, start, and ingress. Do not accidentally select a different historical conversation or silently change default routing.
- Find all mutations that bypass model callbacks: `update_all`, `update_column(s)`, bulk actions, merge/delete, assignment, support-line backfill, and raw SQL. Add each to the boundary checklist.
- Define and fixture the envelope, ID normalization, origin/epoch propagation, durable event ordering, idempotency responses, workflow guard, delivery admission and lifecycle protocols.
- Record performance baselines for conversation list/count/search, support send, ingress, realtime, and the largest representative transcript/attachment set.

Evidence from inspection: current support APIs often use display IDs, message FKs use internal IDs, and multiple Extra state stores accept conversation ID without account. New contracts must make the distinction explicit. Inspect the actual presenter serialization before adapting legacy fields.

Exit: all enabled-inbox senders/read surfaces have an owner and an enforcement point. An unknown autonomous sender or unmatched Telegram identity blocks enablement for that inbox, rather than weakening isolation.

## 3. Phase B: additive persistence and default-off compatibility

Chatwoot additions:

- `account_users.retention_member` and an admin membership update service that validates selected users and expected revision atomically. Revoking the last member remains allowed with active sessions; administrators can assign an eligible replacement afterward without releasing sessions to support.
- Session models and snapshot UUID/digest receipts in Chatwoot; immutable snapshot/file tables in Extra; future read-marker tables; conversation pointer/epoch/archive/support-cycle fields; immutable message attribution.
- Durable request/delivery operation records and workflow outbox with stable UUIDs and per-conversation sequence.
- Foreign keys, partial uniqueness for unfinished sessions, account consistency constraints, snapshot uniqueness, deterministic ordering and required indexes.
- Proposed services: `Retention::AccessPolicy`, `Retention::ConversationResolver`, `Retention::StartService`, `Retention::CompleteService`, `Retention::SnapshotBuilder`, `Conversations::WorkflowPolicy`, and a transport admission service. Use existing extension hooks for enterprise compatibility.

Extra additions:

- Explicit workflow DTO and normalization, authenticated internal workflow client, lifecycle inbox/projection, and a central workflow gate.
- Ordered support-event inbox for enabled accounts so historical facts and current actions can be handled independently.
- Narrow migrations for affected account/conversation/epoch keys and provenance; no retention transcript table in the support archive.

Migration constraints: existing rows mean support with epoch 0 and no session. Add columns/indexes using deployment-safe migration patterns; build large indexes concurrently where supported by the migration runner. Backfill in bounded batches only if necessary. Do not rewrite every historical message, status, or report. A schema rollback must not delete snapshots or erase message attribution; roll forward or disable starts while keeping readers/guards.

Exit: with starts off and no sessions, ordinary support behavior and response shapes match baseline. New fields are additive and old clients tolerate them.

## 4. Phase C: enforce server boundaries before exposing entry

Implement shared query and mutation policies across these paths:

| Area | Existing files / groups to change or inspect |
| --- | --- |
| Policy and controllers | `app/policies/conversation_policy.rb`; `app/controllers/api/v1/accounts/conversations_controller.rb`; `app/controllers/api/v1/accounts/conversations/base_controller.rb`; nested messages, labels, participants, drafts, direct uploads, assignments, linked sources; enterprise conversation policy/controller. |
| Lists and filters | `app/finders/conversation_finder.rb`; `app/services/conversations/filter_service.rb`; permission filter service and enterprise overlay; contact conversations; participating/mine/unassigned/resolved/mentions paths. |
| Search and export | `app/services/search_service.rb`; enterprise search; message indexing and result serialization; transcript/attachment exports; all-message/recent APIs used by Extra; support-only projection. |
| Core callbacks | `app/models/conversation.rb`; `app/models/message.rb`; assignment/activity concerns; account support-line backfill. |
| Event handling | Dispatcher/outbox integration; automation, webhook, agent-bot, reporting, notification, participation, hooks/campaign/CSAT listeners; enterprise Captain and SLA overlays. |
| Jobs | EventDispatcher, ActionCableBroadcast, SendReply, auto-resolution, snooze reopen, activity messages, bots, notifications, integration hooks, voice forwarding, enterprise SLA/Captain jobs. |
| Reports | V2 count/summary/conversation builders, live reports; exclude retention messages and activity while preserving historical support facts and legacy formulas for untouched conversations. |
| Channel routing | Telegram ingress/callback/voice/business flows; send/edit/delete/status/media adapter entry points. |

Use explicit scopes before pagination/counting and before all alternate relation branches. Do not introduce `Conversation.default_scope`. Show ordinary conversation URLs as inaccessible during retention, including for selected specialists; their valid route is the retention route. Dedicated transport callbacks retain narrow access under channel authentication.

Realtime requires both publication-time and delivery-time checks. `ActionCableBroadcastJob` currently re-fetches conversation data for several events and retains its original recipients. Prevent that combination from delivering retained content to an earlier support audience. Retention events use authorized user channels and a workflow revision; ordinary users receive only a removal/invalidation event. Recompute access when a queued broadcast runs and after membership changes.

Protect existing indexed support content while its chat is retained. Filter search results and counts using authoritative accessible conversation IDs, before exposing snippets or aggregations; deleting index documents alone is insufficient. Apply equivalent checks to Extra's search/SSE/export and mapped Telegram Dialogues APIs.

Exit: even hand-crafted requests, stale tabs, old jobs and index lag cannot expose or mutate an active retention conversation through support paths. Transport still delivers permitted customer and specialist messages.

## 5. Phase D: atomic lifecycle and snapshot capture

Implement start/complete/takeover with account-scoped idempotency, expected revisions, lock ordering, and durable delivery intents. All relevant writes reload workflow under the same lock. Tag messages before callbacks; save operation scope and epoch before asynchronous jobs serialize. Ensure account membership changes and conversation permission checks cannot race to authorize a removed specialist.

Snapshot capture must copy all available message content and metadata, private/activity/deleted state, replies, identity labels and attachments belonging to the captured `retention_session_id`. Earlier support history and other retention sessions are excluded, including their attachment references. Use ordered session-attributed database rows and original Chatwoot media metadata (with legacy copied files readable), not the webhook context or a live paginated export. Follow the implemented signed prepare/commit protocol in Extra; Chatwoot stores only the receipt. Add an immutable manifest, deterministic serialization/digest, and current-session attribution. Completed snapshots do not join live content on reads.

Provider dispatch is outside the database transaction. Admission records prevent start/complete while an earlier conflicting dispatch is still active or uncertain. A retried first-send request returns the same message; a failed provider send remains visible; explicit retry operates on that message. Never promise provider exactly-once delivery after an ambiguous timeout.

Completion must bypass support resolution side effects through a persisted retention reason while retaining normal archive behavior. The post-completion inbound path starts a fresh support cycle. Record the separate archive timestamp and adjust archive ordering without a fabricated support resolution event.

Performance acceptance: use realistic large histories, compare bulk-copy duration, lock contention, database/WAL growth, API latency and storage expansion across repeated snapshots. If the measured maximum cannot meet the target, implement the staging strategy described in the design before enabling those cases. Incoming events must be durably accepted and retried under bounded contention; never acknowledged and then lost.

Exit: capture failure leaves the chat retained; capture success always has a usable immutable transcript and archived conversation. Later live edits/deletions and operator renames do not alter saved metadata. Original media remains available only while Chatwoot retains its file.

## 6. Phase E: Extra integration and delayed effects

Implement the [integration contract](../../../chatwoot-extra/docs/retention-space/integration-contract.md) inventory completely for enabled identities. The webhook gate precedes subscriber selection. Retention lifecycle uses an independent handler, not support `conversation_updated` logic. Snapshot-ready has no support AI subscriber.

Split historic fact ingestion from current workflow effects where the existing subscriber combines them. Filter all contextual arrays and support export/import paths. Make previous-epoch timers and writes inert even after completion. Tag new delayed jobs; drain/classify or retire old untagged work for the rollout cohort. Keep normal jobs for other accounts working.

At actual send time, route direct ads/media/edit/delete operations through the shared admission boundary. Batch recipient lists and cached state do not grant send permission. Add mapped access controls to Telegram Dialogues and require any external autonomous sender to participate before its inbox is enabled.

Exit: injecting a retention event yields no support archive/statistic/notification/AI/automation side effect. Injecting a legitimate delayed support fact preserves it without a stale live effect. Out-of-order lifecycle replay converges to the correct state.

## 7. Phase F: UI using existing Chatwoot patterns

Proposed new files:

- `app/javascript/dashboard/routes/dashboard/settings/account/components/RetentionSpecialists.vue`
- `app/javascript/dashboard/routes/dashboard/retention/retention.routes.js`
- `app/javascript/dashboard/routes/dashboard/retention/RetentionView.vue`
- `app/javascript/dashboard/routes/dashboard/retention/RetentionSearch.vue`
- `app/javascript/dashboard/routes/dashboard/retention/RetentionSession.vue`
- `app/javascript/dashboard/routes/dashboard/retention/RetentionHistory.vue`
- `app/javascript/dashboard/routes/dashboard/retention/RetentionSnapshot.vue`
- `app/javascript/dashboard/api/retention.js`
- `app/javascript/dashboard/store/modules/retention.js`

Existing integration points: Account Settings `Index.vue` and `SectionLayout.vue`, Sidebar's menu/capabilities, authenticated route guard, support conversation event handlers/store, existing composer primitives and `components-next/` bubbles. Use Composition API for new Vue components and Tailwind tokens per `AGENTS.md`. Add matching English/Russian locale keys.

The retention store owns session lists, drafts, transcript, read markers, snapshots and revisions. The support store never receives a retained conversation body. A retention composer capability set permits plain messaging and blocks support tasks/macros/AI/tracking hooks on the server and UI. Reuse rendering/editing code only after identifying mount and watch side effects in `ConversationBox`, `ReplyBox` and related composables.

Implement all states from the design, including first-send conflict, stale acknowledgment, failed/uncertain delivery, snapshot failure, membership revocation, archived-then-reopened race, and reconnect refresh. Opening History or a preview must not invoke support `update_last_seen`, presence, notifications or response tracking.

Exit: a specialist can complete the full workflow using keyboard and pointer on desktop and narrow layouts, in light/dark themes and English/Russian, with familiar Chatwoot controls.

## 8. Verification matrix

These are required implementation acceptance scenarios, not tests claimed to have passed in this design change. Extend the closest existing suites and add meaningful boundary/concurrency coverage during implementation. The user's explicit zero-regression requirement makes support parity a release gate.

| Area | Scenario | Required result |
| --- | --- | --- |
| Baseline | Feature off, unchanged support input | Same visible conversations, statuses, routing, metrics, notifications and message delivery as baseline. |
| Membership | Admin adds/removes members; non-admin calls API | Only authorized updates; immediate revocation; active sessions remain recoverable. |
| Account isolation | Two accounts share display ID and same username | No cross-account results, mutations, caches, events, dedupe or snapshots. |
| Inbox/enterprise | Restricted role, no inbox membership, administrator not selected | Consistent documented access across UI/API/search/realtime/media/history. |
| Preview | Open result, type, upload, leave | No session or support workflow/read/presence change. |
| Search | Name, mixed-case @handle, t.me handle, numeric ID, duplicate names/sources/physical-chat records | Correct normalized results, canonical ingress conversation, permissions and pagination; an older alias cannot bypass isolation or send admission. |
| First send | Valid message/attachment | Exactly one session and accepted message in one transaction; normal Telegram delivery. |
| First send failure | Validation or transaction rollback | No session, mode change, or delivery intent. |
| Concurrency | Two first sends, duplicate request, changed support revision | One session; stable idempotent result or conflict; no silently duplicated/lost draft. |
| Takeover | Support operator sends/assigns while specialist starts | Lock ordering produces a defined before/after result; stale action rejected. |
| Transport | Pending or uncertain support send at takeover | Start cannot claim isolation until the prior operation is resolved. |
| Active replies | Customer text, photo, document, voice, business update, edit/delete | Correct session attribution; preserved transport; no auto-transcription or support automation. |
| Visibility | Normal lists, counts, filters, direct URL, contact history, search/index lag, attachments, notifications, export | Active retained chat/content absent; account/inbox restrictions enforced server-side. |
| Realtime | Queued broadcast addressed to old support audience executes after start | No retained payload leak; support receives removal/refetch; eligible retention users receive messages. |
| Current tracking | Retention first send, reply, read, takeover, completion | No support response/resolution row, CSAT, quality review, topic, task, unread or presence activity. |
| Historical facts | Legitimate support event arrives after start/end | Prior support fact survives with correct epoch; no stale live effect or current timer contamination. |
| Old jobs | Auto-close/break/automation/SLA/bot/webhook retry before start runs during or after retention | No stale send/assignment/close/survey/notification. |
| Direct sends | Preselected ad list, scheduled batch, explicit player list, test send, media edit/delete | Shared admission blocks the retained identity and records a clear skip/conflict. |
| Alternate integration | Mapped Telegram Dialogues API/SSE/media/send reaches same chat | Same retention access and delivery barriers apply. |
| Completion | Complete while incoming message races | Exact transaction boundary; message either in snapshot/retention or fresh support, never lost. |
| Completion failure | Extra snapshot/file preparation or Chatwoot commit fails | Chat remains retained and no completed snapshot is advertised. |
| Completion retry | Network timeout then same request again | Same snapshot/session result, no duplicate history entry. |
| Whole history | More than 20/100/one page of messages, private notes, activities, attachments, earlier sessions | Full available transcript captured with original metadata and current-session attribution. |
| Snapshot scope | Support before/between/after sessions, repeated sessions, overlapping timestamps | Only messages and attachments attributed to the captured session are stored; historical snapshots remain independent. |
| Snapshot stability | Later live edit/delete, contact/operator rename, repeat session, blob cleanup | Prior snapshot content/digest/identity/media metadata unchanged; removed original media becomes unavailable. |
| Resume | New support reply after archive | Existing routing restored, clean response baseline, no retention time/messages in support metrics or AI context. |
| Archive | Retention completion without support resolution event | Conversation visible and correctly ordered in archive, support resolution count unchanged. |
| Export/reimport | Export archived chat then import support data | Retention messages cannot re-enter support archive/analytics/index. |
| Recovery | Extra down, Redis reset, worker crash, outbox duplicates/reordering | No lost accepted chat or snapshot; dependent effects retry safely; projections converge. |
| Disable starts | Turn launch flag off with sessions active | New starts stop; current chat access, isolation, completion and history remain usable. |
| UX | Keyboard, narrow viewport, long names, empty/error/loading states, ru/en | Accessible controls, preserved drafts/navigation, readable layouts and correct copy. |

Existing relevant Rails suite locations include `spec/models`, `spec/listeners`, `spec/services`, `spec/policies`, `spec/jobs`, `spec/finders`, `spec/controllers/api/v1/accounts`, `spec/controllers/api/v2/accounts`, and enterprise equivalents. Target conversation/message/search/report/event/job tests around modified boundaries before running required broader gates.

Typical verification commands for the implementation:

```sh
# Chatwoot, from its repository
bundle exec rspec spec/models/message_spec.rb spec/models/conversation_spec.rb
bundle exec rspec spec/listeners/automation_rule_listener_spec.rb spec/listeners/webhook_listener_spec.rb spec/listeners/reporting_event_listener_spec.rb
bundle exec rspec spec/controllers/api/v1/accounts/conversations_controller_spec.rb spec/controllers/api/v1/accounts/conversations/messages_controller_spec.rb
pnpm test
# Run RuboCop and ESLint on the actual changed Ruby/JS/Vue files.

# chatwoot-extra, from its repository
bun test
bun run check
```

Add the new targeted retention/contract/concurrency suites to these commands once they exist. Run real transaction/queue integration tests against disposable PostgreSQL, Redis and RabbitMQ, using a fake Telegram adapter capable of success, timeout, failure, duplicate update and delayed response. Do not send staging verification messages to real customers. Measure inactive-account overhead and active-cohort behavior; agree latency/lock/storage thresholds from the Phase A baseline before launch.

## 9. Deployment, observation and rollback

1. Apply additive database changes with starts disabled. Deploy tolerant consumers and authoritative guard/delivery interfaces.
2. Deploy producers and every Rails/Extra worker version needed for the contract. Stop old workers for the launch cohort and classify/drain old work. Verify configured webhook endpoints and external sender compliance.
3. Run parity/shadow checks and the matrix in staging. Verify content-free isolation telemetry, snapshot/media restore, and rollback behavior.
4. Enable a small selected account/inbox cohort and a few specialists. Confirm real workflow usability, message delivery, snapshot completeness and ordinary-support metrics before expanding.

Observe active session counts, first-send conflicts, pending/uncertain delivery age, completion latency/failures, snapshot count/digest mismatches, outbox/inbox lag, stale-epoch suppression, guard failures, authorization denials and unexpected retention-origin writes into support stores. Logs carry IDs and reason codes, not transcripts, credentials or Telegram bot tokens. Alert on a snapshotless completed session or a support side effect admitted during retention; both violate release invariants.

Rollback order: disable new starts; retain guards and current workspace; resolve pending/uncertain sends; let sessions complete or use an audited administrative completion that still saves a snapshot; verify no active sessions; keep message-origin filters and snapshot readers while rolling forward a fix. Old application versions that ignore attribution or snapshots are not safe rollback targets once retention has been used.

## 10. Original design-step completion criteria

- Both repositories prepared on separate branch instances after updating `main`.
- Shared behavior and UX specified, including access, first-send boundary, completion, repeated sessions and immutable full history.
- Inspected integration points named with current bypasses and race conditions addressed.
- Cross-repository API/event ownership, rollout sequence, failure behavior and regression acceptance defined.
- The original design-only step was completed before the user requested the missing settings selector. The membership milestone above is implemented; the remaining runtime work, staging validation and production activation are still pending.
