class Conversations::AssignmentService
  def initialize(conversation:, assignee_id:, assignee_type: nil)
    @conversation = conversation
    @assignee_id = assignee_id
    @assignee_type = assignee_type
  end

  def perform
    agent_bot_assignment? ? assign_agent_bot : assign_agent
  end

  private

  attr_reader :conversation, :assignee_id, :assignee_type

  def assign_agent
    assignee_before = conversation.assignee

    conversation.log_agent_assignment(
      source: 'Conversations::AssignmentService#assign_agent',
      assignee_before: assignee_before,
      assignee_after: assignee,
      context: {
        assignee_id: assignee_id,
        assignee_type: assignee_type,
        assignee_name: assignee&.name,
        assignee_email: assignee&.email,
        clearing_agent_bot: conversation.assignee_agent_bot_id.present?
      }
    )

    conversation.assignee = assignee
    conversation.assignee_agent_bot = nil
    conversation.save!
    assignee
  end

  def assign_agent_bot
    return unless agent_bot

    assignee_before = conversation.assignee

    conversation.log_agent_assignment(
      source: 'Conversations::AssignmentService#assign_agent_bot',
      assignee_before: assignee_before,
      assignee_after: nil,
      context: {
        assignee_id: assignee_id,
        assignee_type: 'AgentBot',
        agent_bot_id: agent_bot.id,
        agent_bot_name: agent_bot.name,
        previous_assignee_agent_bot_id: conversation.assignee_agent_bot_id
      }
    )

    conversation.assignee = nil
    conversation.assignee_agent_bot = agent_bot
    conversation.save!
    agent_bot
  end

  def assignee
    @assignee ||= conversation.account.users.find_by(id: assignee_id)
  end

  def agent_bot
    @agent_bot ||= AgentBot.accessible_to(conversation.account).find_by(id: assignee_id)
  end

  def agent_bot_assignment?
    assignee_type.to_s == 'AgentBot'
  end
end
