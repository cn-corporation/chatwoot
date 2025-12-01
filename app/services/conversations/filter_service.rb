class Conversations::FilterService < FilterService
  ATTRIBUTE_MODEL = 'conversation_attribute'.freeze

  def initialize(params, user, account)
    @account = account
    super(params, user)
  end

  def perform
    validate_query_operator
    @conversations = query_builder(@filters['conversations'])
    mine_count, unassigned_count, all_count, = set_count_for_all_conversations
    assigned_count = all_count - unassigned_count

    {
      conversations: conversations,
      count: {
        mine_count: mine_count,
        assigned_count: assigned_count,
        unassigned_count: unassigned_count,
        all_count: all_count
      }
    }
  end

  def base_relation
    # Check if we need to join contacts for player_status or behavior_status filters
    needs_contact_join = @params[:payload]&.any? do |filter|
      %w[player_status behavior_status].include?(filter[:attribute_key])
    end

    conversations = if needs_contact_join
                      @account.conversations.joins(:contact).distinct.includes(
                        :taggings, :inbox, { assignee: { avatar_attachment: [:blob] } }, { contact: { avatar_attachment: [:blob] } }, :team, :messages, :contact_inbox
                      )
                    else
                      @account.conversations.includes(
                        :taggings, :inbox, { assignee: { avatar_attachment: [:blob] } }, { contact: { avatar_attachment: [:blob] } }, :team, :messages, :contact_inbox
                      )
                    end

    Conversations::PermissionFilterService.new(
      conversations,
      @user,
      @account
    ).perform
  end

  def current_page
    @params[:page] || 1
  end

  def filter_config
    {
      entity: 'Conversation',
      table_name: 'conversations'
    }
  end

  def conversations
    @conversations.sort_on_last_activity_at.page(current_page)
  end
end
