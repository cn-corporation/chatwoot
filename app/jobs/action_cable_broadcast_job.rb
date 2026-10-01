class ActionCableBroadcastJob < ApplicationJob
  queue_as :critical
  include Events::Types

  CONVERSATION_UPDATE_EVENTS = [
    CONVERSATION_READ,
    CONVERSATION_UPDATED,
    TEAM_CHANGED,
    ASSIGNEE_CHANGED,
    CONVERSATION_STATUS_CHANGED
  ].freeze

  def perform(members, event_name, data)
    return if members.blank?
    return unless retention_broadcast_allowed?(event_name, data)

    broadcast_data = prepare_broadcast_data(event_name, data)
    broadcast_to_members(members, event_name, broadcast_data)
  end

  private

  def retention_broadcast_allowed?(event_name, data)
    return true if event_name == 'retention.changed'
    return notification_allowed?(event_name, data.with_indifferent_access) if event_name.start_with?('notification.')

    payload = data.with_indifferent_access
    id = broadcast_conversation_id(event_name, payload)
    return true unless id
    return true unless payload[:account_id]

    matching_workflow?(payload, id)
  end

  def matching_workflow?(payload, id)
    conversation = Conversation.support.find_by(account_id: payload[:account_id], display_id: id)
    return false unless conversation

    epoch = payload[:workflow_epoch] || payload.dig(:conversation, :workflow_epoch) || 0
    epoch.to_i == conversation.workflow_epoch
  end

  def notification_allowed?(event_name, payload)
    return true if event_name == 'notification.deleted'

    Notification.find_by(id: payload.dig(:notification, :id))&.delivery_allowed?
  end

  def broadcast_conversation_id(event_name, payload)
    return payload[:conversation_id] if event_name.start_with?('message.')
    return unless event_name.start_with?('conversation.', 'assignee.', 'team.')

    payload.dig(:conversation, :id) || payload[:id]
  end

  # Ensures that only the latest available data is sent to prevent UI issues
  # caused by out-of-order events during high-traffic periods. This prevents
  # the conversation job from processing outdated data.
  def prepare_broadcast_data(event_name, data)
    if event_name.start_with?('notification.') && event_name != 'notification.deleted'
      notification = Notification.find_by(id: data.dig(:notification, :id))
      return data.merge(notification: notification.push_event_data) if notification&.retention_notification?
    end
    return data unless CONVERSATION_UPDATE_EVENTS.include?(event_name)

    account = Account.find(data[:account_id])
    conversation = account.conversations.find_by!(display_id: data[:id])
    conversation.push_event_data.merge(account_id: data[:account_id])
  end

  def broadcast_to_members(members, event_name, broadcast_data)
    members.each do |member|
      ActionCable.server.broadcast(
        member,
        {
          event: event_name,
          data: broadcast_data
        }
      )
    end
  end
end
