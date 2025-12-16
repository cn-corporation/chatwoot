# Agent Assignment Logging

This document describes the comprehensive logging system for tracking agent assignments to conversations at the database level.

## Table of Contents
- [Quick Start](#quick-start)
- [Log File Location](#log-file-location)
- [Log Format](#log-format)
- [Logging Points](#logging-points)
- [Implementation Details](#implementation-details)
- [Usage](#usage)
- [Benefits](#benefits)
- [Notes](#notes)

## Quick Start

To view agent assignment logs in real-time:
```bash
# Local development
tail -f log/agent_assignment/agent_assignment.log | jq '.'

# Docker container
docker exec -it chatwoot-rails-1 tail -f /app/log/agent_assignment/agent_assignment.log | jq '.'
```

To find who assigned a specific conversation:
```bash
cat log/agent_assignment/agent_assignment.log | jq 'select(.conversation_id == 123)'
```

## Log File Location

All agent assignment logs are written to: `log/agent_assignment/agent_assignment.log`

This file rotates daily and contains detailed JSON-formatted logs.

### Docker Volume

In Docker deployments, the `log/agent_assignment` directory is mounted as a named volume `agent_assignment_logs` to persist logs across container restarts. This is configured in all docker-compose files:
- `docker-compose.yaml` (development)
- `docker-compose.production.yaml` (production)
- `docker-compose.coolify.yaml` (Coolify deployment)
- `docker-compose.test.yaml` (testing)
- `.devcontainer/docker-compose.yml` (devcontainer)

## Log Format

Each log entry contains:
- **timestamp**: ISO8601 formatted timestamp
- **source**: The exact method/location where the assignment happened
- **triggered_by**: Information about the user who triggered the assignment (if available)
  - `user_id`: ID of the user who triggered the assignment
  - `user_name`: Name of the user
  - `user_email`: Email of the user
  - `account_id`: Account ID of the user
- **conversation_id**: ID of the conversation being assigned
- **account_id**: Account ID
- **inbox_id**: Inbox ID
- **contact_id**: Contact ID
- **team_id**: Team ID (if applicable)
- **status**: Current conversation status
- **assignee_before**: Details of the previous assignee (or null)
- **assignee_after**: Details of the new assignee (or null)
- **context**: Additional contextual information specific to each assignment type
- **backtrace**: Full stack trace showing how the assignment was triggered (15 frames)

### Example Log Entry

```json
{
  "timestamp": "2025-12-16T14:32:15.742Z",
  "source": "Conversations::AssignmentService#assign_agent",
  "triggered_by": {
    "user_id": 42,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "account_id": 1
  },
  "conversation_id": 12345,
  "account_id": 1,
  "inbox_id": 5,
  "contact_id": 789,
  "team_id": 3,
  "status": "open",
  "assignee_before": null,
  "assignee_after": {
    "id": 15,
    "name": "Agent Smith",
    "email": "agent.smith@example.com",
    "availability_status": "online"
  },
  "context": {
    "assignee_id": 15,
    "assignee_type": null,
    "assignee_name": "Agent Smith",
    "assignee_email": "agent.smith@example.com",
    "clearing_agent_bot": false
  },
  "backtrace": [
    "/app/app/services/conversations/assignment_service.rb:19:in `assign_agent'",
    "/app/app/services/conversations/assignment_service.rb:9:in `perform'",
    "/app/app/controllers/api/v1/accounts/conversations/assignments_controller.rb:16:in `create'",
    "..."
  ]
}
```

**Note**: When `triggered_by` is `null`, it indicates a system-initiated assignment (e.g., background jobs, automatic callbacks) where no user action directly triggered it.

## Logging Points

### 1. Auto-Assignment v2 (AutoAssignment::AssignmentService)
**Location**: `app/services/auto_assignment/assignment_service.rb:58`

**Source**: `AutoAssignment::AssignmentService#assign_conversation`

**Triggered by**:
- Auto-assignment jobs
- Periodic assignment jobs
- Rate-limited round-robin assignment

**Context includes**:
- inbox_id, inbox_name
- auto_assignment_v2_enabled
- assignment_config
- agent_id, agent_name, agent_email
- agent_availability

### 2. Legacy Auto-Assignment (AutoAssignment::AgentAssignmentService)
**Location**: `app/services/auto_assignment/agent_assignment_service.rb:11`

**Source**: `AutoAssignment::AgentAssignmentService#perform`

**Triggered by**:
- Legacy auto-assignment system
- Team-based auto-assignment
- Inbox-based auto-assignment

**Context includes**:
- allowed_agent_ids
- allowed_online_agent_ids
- new_assignee details

### 3. Manual Assignment (Conversations::AssignmentService)
**Location**: `app/services/conversations/assignment_service.rb:16`

**Source**:
- `Conversations::AssignmentService#assign_agent` (for user agents)
- `Conversations::AssignmentService#assign_agent_bot` (for agent bots)

**Triggered by**:
- API endpoint: `/api/v1/accounts/{id}/conversations/{id}/assignments`
- Manual agent selection in UI

**Context includes**:
- assignee_id, assignee_type
- assignee_name, assignee_email
- clearing_agent_bot flag
- agent_bot_id, agent_bot_name (for bot assignments)

### 4. Automation Rules & Macros (ActionService)
**Location**: `app/services/action_service.rb:39`

**Source**: `ActionService#assign_agent`

**Triggered by**:
- Automation rules
- Macros
- Workflow actions

**Context includes**:
- action: 'assign' or 'unassign'
- agent_ids_param
- agent details
- trigger: 'automation_or_macro'
- inbox_members

### 5. Self-Assignment on Status Toggle (ConversationsController)
**Location**: `app/controllers/api/v1/accounts/conversations_controller.rb:160`

**Source**: `Api::V1::Accounts::ConversationsController#assign_conversation`

**Triggered by**:
- Status change in UI (when agent opens/resolves conversation)

**Context includes**:
- action: 'self_assignment'
- current_user details
- trigger: 'status_toggle'

### 6. Bulk Assignment (BulkActionsJob)
**Location**: `app/jobs/bulk_actions_job.rb:24`

**Source**: `BulkActionsJob#bulk_conversation_update`

**Triggered by**:
- Bulk actions in UI
- Bulk update API calls

**Context includes**:
- action: 'bulk_update'
- params (all fields being updated)
- current_user details

### 7. Assignment on Conversation Creation (ConversationBuilder)
**Location**: `app/builders/conversation_builder.rb:16`

**Source**: `ConversationBuilder#create_new_conversation`

**Triggered by**:
- New conversation creation with pre-assigned agent
- API conversation creation

**Context includes**:
- action: 'conversation_creation'
- assignee_id, team_id
- inbox_id, contact_id
- initial_status

### 8. Bulk Unassignment on Agent Deletion (Agents::DestroyJob)
**Location**: `app/jobs/agents/destroy_job.rb:32`

**Source**: `Agents::DestroyJob#unassign_conversations`

**Triggered by**:
- Agent removal from account

**Context includes**:
- operation: 'bulk_unassignment'
- trigger: 'agent_deletion'
- deleted_user_id, deleted_user_name, deleted_user_email (the agent being deleted)
- conversation_ids, conversation_count

### 9. Bulk Unassignment on User Logout (Warden Hook)
**Location**: `config/initializers/warden_hooks.rb:7`

**Source**: `Warden::Manager.before_logout`

**Triggered by**:
- User logout (Warden authentication)

**Context includes**:
- operation: 'bulk_unassignment'
- trigger: 'user_logout'
- logout_user_id, logout_user_name, logout_user_email (the user logging out)
- conversation_ids, conversation_count

### 10. Bulk Unassignment on User Logout (SessionsController)
**Location**: `app/controllers/devise_overrides/sessions_controller.rb:53`

**Source**: `DeviseOverrides::SessionsController#destroy`

**Triggered by**:
- User logout (Devise controller)

**Context includes**:
- operation: 'bulk_unassignment'
- trigger: 'user_logout_via_controller'
- logout_user_id, logout_user_name, logout_user_email (the user logging out)
- conversation_ids, conversation_count

### 11. Team Change Assignment (AssignmentHandler - Auto-assign from team)
**Location**: `app/models/concerns/assignment_handler.rb:12`

**Source**: `AssignmentHandler#ensure_assignee_is_from_team`

**Triggered by**:
- Conversation team_id change
- Team-based auto-assignment

**Context includes**:
- trigger: 'team_change'
- team_id, team_name
- team_allow_auto_assign
- team_members_with_capacity

### 12. Team Change Validation (AssignmentHandler - Remove invalid assignee)
**Location**: `app/models/concerns/assignment_handler.rb:41`

**Source**: `AssignmentHandler#validate_current_assignee_team`

**Triggered by**:
- Team change when current assignee is not in new team

**Context includes**:
- trigger: 'team_change_validation'
- reason: 'assignee_not_in_team'
- team_id, team_name
- previous_assignee_id
- team_member_ids

## Implementation Details

### Logger Setup
The logger is initialized in `config/initializers/agent_assignment_logger.rb` as a global constant `AGENT_ASSIGNMENT_LOGGER`.

### Logging Concern
The `AgentAssignmentLogger` concern (`app/models/concerns/agent_assignment_logger.rb`) provides:
- `log_agent_assignment`: Instance method for single conversation assignments
- `log_bulk_agent_assignment`: Class method for bulk operations

### Integration
The `AgentAssignmentLogger` concern is included in the `Conversation` model, making logging methods available throughout the codebase.

## Usage

### Reading Logs
```bash
# Tail the log file
tail -f log/agent_assignment/agent_assignment.log

# Search for specific conversation
grep "conversation_id.*123" log/agent_assignment/agent_assignment.log

# Search by source
grep "AutoAssignment::AssignmentService" log/agent_assignment/agent_assignment.log

# Search by triggering user
grep "triggered_by.*user_name.*John" log/agent_assignment/agent_assignment.log

# Count assignments per day (example for January 2025)
grep "timestamp.*2025-01-" log/agent_assignment/agent_assignment.log | wc -l
```

### Log Analysis
Each log entry is JSON formatted for easy parsing:
```bash
# Pretty print logs
cat log/agent_assignment/agent_assignment.log | jq '.'

# Extract all sources
cat log/agent_assignment/agent_assignment.log | jq -r '.source' | sort | uniq -c

# Find all auto-assignments
cat log/agent_assignment/agent_assignment.log | jq 'select(.source | contains("AutoAssignment"))'

# Find unassignments
cat log/agent_assignment/agent_assignment.log | jq 'select(.assignee_after == null)'

# Find assignments triggered by a specific user
cat log/agent_assignment/agent_assignment.log | jq 'select(.triggered_by.user_id == 123)'

# Group assignments by triggering user
cat log/agent_assignment/agent_assignment.log | jq -r '.triggered_by.user_name // "system"' | sort | uniq -c
```

### Docker Volume Management
```bash
# List all docker volumes
docker volume ls | grep agent_assignment

# Inspect the volume
docker volume inspect chatwoot_agent_assignment_logs

# Access logs from within a running container
docker exec -it chatwoot-rails-1 tail -f /app/log/agent_assignment/agent_assignment.log

# Backup logs from the volume
docker run --rm -v chatwoot_agent_assignment_logs:/data -v $(pwd):/backup alpine tar czf /backup/agent_assignment_logs_backup.tar.gz -C /data .

# Restore logs to the volume
docker run --rm -v chatwoot_agent_assignment_logs:/data -v $(pwd):/backup alpine tar xzf /backup/agent_assignment_logs_backup.tar.gz -C /data
```

## Benefits

1. **Complete Traceability**: Every assignment change is logged with full context
2. **Debugging**: Full backtrace helps identify the code path that triggered assignment
3. **Audit Trail**: Detailed logs for compliance and auditing
4. **Performance Analysis**: Identify bottlenecks in assignment logic
5. **Business Intelligence**: Analyze assignment patterns and agent workload
6. **Troubleshooting**: Quickly identify why a conversation was assigned to a specific agent

## Notes

- Logs are at the closest possible level to database operations
- All updates (including `update_all` bulk operations) are logged
- Backtraces capture 15 frames for detailed trace analysis
- Logs include both before and after states for assignments
- Bulk operations log all conversation IDs affected
- **triggered_by** field captures the user who initiated the assignment (when available via `Current.user`)
  - **Will be populated** for: Manual assignments, bulk actions, macros/automation rules triggered by users, self-assignments
  - **May be null** for: Background jobs, scheduled tasks, system callbacks, webhook-triggered assignments
  - **Special cases**: For logout and agent deletion, `triggered_by` contains the user being logged out/deleted
- In Docker deployments, logs are persisted in a named volume for durability
- Log rotation happens daily with the naming pattern: `agent_assignment.log.YYYYMMDD`
