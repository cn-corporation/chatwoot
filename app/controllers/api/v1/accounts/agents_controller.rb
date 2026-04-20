class Api::V1::Accounts::AgentsController < Api::V1::Accounts::BaseController
  before_action :fetch_agent, except: [:create, :index, :bulk_create]
  before_action :check_authorization
  before_action :validate_limit, only: [:create]
  before_action :validate_limit_for_bulk_create, only: [:bulk_create]
  before_action :prevent_self_logout, only: [:force_logout]

  def index
    @agents = agents
  end

  def create
    builder = AgentBuilder.new(
      email: new_agent_params['email'],
      name: new_agent_params['name'],
      role: new_agent_params['role'],
      availability: new_agent_params['availability'],
      auto_offline: new_agent_params['auto_offline'],
      inviter: current_user,
      account: Current.account
    )

    @agent = builder.perform
  end

  def update
    @agent.update!(agent_params.slice(:name).compact)
    @agent.current_account_user.update!(agent_params.slice(*account_user_attributes).compact)
  end

  def destroy
    @agent.current_account_user.destroy!
    delete_user_record(@agent)
    head :ok
  end

  def bulk_create
    emails = params[:emails]

    emails.each do |email|
      builder = AgentBuilder.new(
        email: email,
        name: email.split('@').first,
        inviter: current_user,
        account: Current.account
      )
      begin
        builder.perform
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.info "[Agent#bulk_create] ignoring email #{email}, errors: #{e.record.errors}"
      end
    end

    # This endpoint is used to bulk create agents during onboarding
    # onboarding_step key in present in Current account custom attributes, since this is a one time operation
    Current.account.custom_attributes.delete('onboarding_step')
    Current.account.save!
    head :ok
  end

  def force_logout
    log_payload = build_force_logout_log_payload(@agent)

    ActionCable.server.broadcast(
      @agent.pubsub_token,
      { event: 'user:logout', data: { account_id: Current.account.id } }
    )

    @agent.tokens = {}
    @agent.regenerate_pubsub_token
    @agent.save!
    @agent.access_token&.regenerate_token
    unassign_open_conversations_for(@agent, log_payload)

    head :ok
  end

  private

  def check_authorization
    super(User)
  end

  def fetch_agent
    @agent = agents.find(params[:id])
  end

  def account_user_attributes
    [:role, :availability, :auto_offline]
  end

  def allowed_agent_params
    [:name, :email, :role, :availability, :auto_offline]
  end

  def agent_params
    params.require(:agent).permit(allowed_agent_params)
  end

  def new_agent_params
    params.require(:agent).permit(:email, :name, :role, :availability, :auto_offline)
  end

  def agents
    @agents ||= Current.account.users.order_by_full_name.includes(:account_users, { avatar_attachment: [:blob] })
  end

  def validate_limit_for_bulk_create
    limit_available = params[:emails].count <= available_agent_count

    render_payment_required('Account limit exceeded. Please purchase more licenses') unless limit_available
  end

  def validate_limit
    render_payment_required('Account limit exceeded. Please purchase more licenses') unless can_add_agent?
  end

  def available_agent_count
    Current.account.usage_limits[:agents] - agents.count
  end

  def can_add_agent?
    available_agent_count.positive?
  end

  def prevent_self_logout
    return unless @agent.id == Current.user.id

    render json: { error: 'You cannot force-logout yourself' }, status: :unprocessable_entity
  end

  def unassign_open_conversations_for(agent, log_payload)
    conversations_to_unassign = agent.assigned_conversations.open
    conversation_ids = conversations_to_unassign.pluck(:id)

    if conversation_ids.any? && defined?(AGENT_ASSIGNMENT_LOGGER)
      AGENT_ASSIGNMENT_LOGGER.info(JSON.pretty_generate(
        log_payload.merge(
          conversation_ids: conversation_ids,
          conversation_count: conversation_ids.size
        )
      ))
    end

    conversations_to_unassign.update_all(assignee_id: nil)
  end

  def build_force_logout_log_payload(agent)
    {
      timestamp: Time.current.iso8601,
      source: 'Api::V1::Accounts::AgentsController#force_logout',
      triggered_by: {
        user_id: Current.user.id,
        user_name: Current.user.name,
        user_email: Current.user.email
      },
      operation: 'bulk_unassignment',
      trigger: 'admin_force_logout',
      logout_user_id: agent.id,
      logout_user_name: agent.name,
      logout_user_email: agent.email,
      assignee_before: { id: agent.id, name: agent.name, email: agent.email },
      assignee_after: nil,
      backtrace: caller(2, 15)
    }
  end

  def delete_user_record(agent)
    DeleteObjectJob.perform_later(agent) if agent.reload.account_users.blank?
  end
end

Api::V1::Accounts::AgentsController.prepend_mod_with('Api::V1::Accounts::AgentsController')
