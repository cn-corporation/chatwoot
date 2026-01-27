class LinkedSourceChannelFinder
  def initialize(conversation)
    @conversation = conversation
    @current_contact_inbox = conversation.contact_inbox
  end

  def perform
    return [] unless @current_contact_inbox&.source_id.present?
    return [] unless telegram_inbox?

    linked_contact_inboxes.filter_map { |ci| build_linked_channel_data(ci) }
  end

  private

  def telegram_inbox?
    @conversation.inbox&.channel_type == 'Channel::Telegram'
  end

  def linked_contact_inboxes
    ContactInbox
      .joins(:contact, :conversations, :inbox)
      .where(source_id: @current_contact_inbox.source_id)
      .where.not(id: @current_contact_inbox.id)
      .where('contact_inboxes.created_at < ?', @current_contact_inbox.created_at)
      .where(inboxes: { account_id: @conversation.account_id, channel_type: 'Channel::Telegram' })
      .distinct
      .order(created_at: :desc)
  end

  def build_linked_channel_data(contact_inbox)
    latest_conversation = contact_inbox.conversations.order(created_at: :desc).first
    return nil unless latest_conversation

    {
      contact_inbox_id: contact_inbox.id,
      inbox_id: contact_inbox.inbox_id,
      source_id: contact_inbox.source_id,
      contact_id: contact_inbox.contact_id,
      contact_name: contact_inbox.contact.name,
      conversation_id: latest_conversation.display_id,
      created_at: contact_inbox.created_at
    }
  end
end
