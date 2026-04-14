class AutomationRuleListener < BaseListener
  def conversation_updated(event)
    process_conversation_event(event, 'conversation_updated')
  end

  def conversation_created(event)
    process_conversation_event(event, 'conversation_created')
  end

  def conversation_opened(event)
    process_conversation_event(event, 'conversation_opened')
  end

  def conversation_resolved(event)
    process_conversation_event(event, 'conversation_resolved')
  end

  def message_created(event)
    message = event.data[:message]

    return if message.activity? || message.auto_reply_email?

    account = message.try(:account)
    changed_attributes = event.data[:changed_attributes]
    originating_rule = performed_by_automation?(event) ? event.data[:performed_by] : nil

    return unless rule_present?('message_created', account)

    rules = current_account_rules('message_created', account)

    rules.each do |rule|
      next if originating_rule && rule.id == originating_rule.id
      next unless automation_sources_match?(rule, message.conversation)

      conditions_match = ::AutomationRules::ConditionsFilterService.new(rule, message.conversation,
                                                                        { message: message, changed_attributes: changed_attributes }).perform
      ::AutomationRules::ActionService.new(rule, account, message.conversation).perform if conditions_match.present?
    end
  end

  private

  def process_conversation_event(event, event_name)
    return if performed_by_automation?(event)

    auto_reply_skip_events = %w[conversation_created conversation_opened]
    return if auto_reply_skip_events.include?(event_name) && ignore_auto_reply_event?(event)

    conversation = event.data[:conversation]
    account = conversation.account
    changed_attributes = event.data[:changed_attributes]

    return unless rule_present?(event_name, account)

    rules = current_account_rules(event_name, account)

    rules.each do |rule|
      next unless automation_sources_match?(rule, conversation)

      conditions_match = ::AutomationRules::ConditionsFilterService.new(rule, conversation, { changed_attributes: changed_attributes }).perform
      AutomationRules::ActionService.new(rule, account, conversation).perform if conditions_match.present?
    end
  end

  def rule_present?(event_name, account)
    return if account.blank?

    current_account_rules(event_name, account).any?
  end

  def current_account_rules(event_name, account)
    AutomationRule.where(
      event_name: event_name,
      account_id: account.id,
      active: true
    )
  end

  def performed_by_automation?(event)
    event.data[:performed_by].present? && event.data[:performed_by].instance_of?(AutomationRule)
  end

  def ignore_auto_reply_event?(event)
    conversation = event.data[:conversation]
    conversation.additional_attributes['auto_reply'].present?
  end

  def automation_sources_match?(rule, conversation)
    sources = ChatwootExtra::AutomationSourcesService.get_sources(rule.id)
    return true if sources.blank?

    sources.include?(conversation.inbox.channel_id)
  rescue StandardError => e
    Rails.logger.error "[AutomationSources] Skipping rule #{rule.id} due to error: #{e.message}"
    false
  end
end
