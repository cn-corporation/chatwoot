class Retention::EventGuard
  def self.allowed?(data, timestamp = nil)
    message = data[:message]
    conversation = data[:conversation] || message&.conversation
    return true unless conversation.is_a?(Conversation)
    return false if message&.retention_session_id.present?

    state = Conversation.support.find_by(id: conversation.id)
    return false unless state

    epoch = data[:workflow_epoch] || message&.workflow_epoch
    origin_allowed?(state, epoch, timestamp)
  end

  def self.origin_allowed?(state, epoch, timestamp)
    return epoch.to_i == state.workflow_epoch if epoch

    state.retention_archived_at.nil? || (timestamp && timestamp > state.retention_archived_at)
  end

  def self.payload_allowed?(payload)
    payload = payload.with_indifferent_access
    return true if payload[:event] == 'retention_changed'

    return false if payload[:retention_session_id].present?

    identity = payload_identity(payload)
    return true unless identity

    account_id, display_id, epoch = identity
    conversation = Conversation.support.find_by(account_id: account_id, display_id: display_id)
    return false unless conversation

    epoch.to_i == conversation.workflow_epoch
  end

  def self.payload_identity(payload)
    nested = payload[:conversation]
    return unless conversation_payload?(payload)

    conversation_data = nested.is_a?(Hash) ? nested : payload
    account_id = payload[:account_id] || payload.dig(:account, :id)
    return if [account_id, conversation_data[:id]].any?(&:nil?)

    [account_id, conversation_data[:id], payload[:workflow_epoch] || conversation_data[:workflow_epoch]]
  end

  def self.conversation_payload?(payload)
    payload[:conversation].present? || payload[:event].to_s.start_with?('conversation')
  end

  private_class_method :origin_allowed?, :payload_identity, :conversation_payload?
end
