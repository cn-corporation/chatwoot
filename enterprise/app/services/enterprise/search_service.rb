module Enterprise::SearchService
  def advanced_search
    # Database filtering keeps retention transitions immediately authoritative,
    # even while the asynchronous search index still contains older documents.
    return filter_messages_with_like if current_account.conversations.where('workflow_epoch > 0').exists?

    where_conditions = { account_id: current_account.id  }
    where_conditions[:inbox_id] = accessable_inbox_ids unless should_skip_inbox_filtering?

    Message.search(
      search_query,
      fields: %w[content attachments.transcribed_text content_attributes.email.subject],
      where: where_conditions,
      order: { created_at: :desc },
      page: params[:page] || 1,
      per_page: 15
    )
  end
end
