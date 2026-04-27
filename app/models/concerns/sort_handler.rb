module SortHandler
  extend ActiveSupport::Concern

  class_methods do
    def sort_on_last_activity_at(sort_direction = :desc)
      order(last_activity_at: sort_direction)
    end

    def sort_on_created_at(sort_direction = :asc)
      order(created_at: sort_direction)
    end

    def sort_on_priority(sort_direction = :desc)
      order(generate_sql_query("priority #{sort_direction.to_s.upcase} NULLS LAST, last_activity_at DESC"))
    end

    def sort_on_waiting_since(sort_direction = :asc)
      order(generate_sql_query("waiting_since #{sort_direction.to_s.upcase} NULLS LAST, created_at ASC"))
    end

    def last_messaged_conversations
      Message.except(:order).select(
        'DISTINCT ON (conversation_id) conversation_id, id, created_at, message_type'
      ).order('conversation_id, created_at DESC')
    end

    def sort_on_last_user_message_at
      order('grouped_conversations.message_type', 'grouped_conversations.created_at ASC')
    end

    def sort_on_last_resolved_at(sort_direction = :desc)
      direction = sort_direction.to_s.upcase
      latest_resolved_subquery = ReportingEvent
                                 .where(name: 'conversation_resolved')
                                 .select('conversation_id, MAX(event_end_time) AS resolved_at')
                                 .group(:conversation_id)
                                 .to_sql
      joins("LEFT JOIN (#{latest_resolved_subquery}) latest_resolved ON latest_resolved.conversation_id = conversations.id")
        .order(generate_sql_query("latest_resolved.resolved_at #{direction} NULLS LAST, conversations.updated_at #{direction}"))
    end

    private

    def generate_sql_query(query)
      Arel::Nodes::SqlLiteral.new(sanitize_sql_for_order(query))
    end
  end
end
