module ConversationMuteHelpers
  extend ActiveSupport::Concern

  def mute!
    resolved!
    contact.update(blocked: true)
    create_muted_message
  end

  def unmute!
    contact.update(blocked: false)
    create_unmuted_message
  end

  def muted?
    contact.blocked? || contact.time_blocked?
  end

  def block_for!(duration_minutes)
    contact.update!(blocked_until: Time.current + duration_minutes.minutes)
    create_blocked_message(duration_minutes)
  end

  def unblock!
    contact.update!(blocked_until: nil)
    create_unblocked_message
  end
end
