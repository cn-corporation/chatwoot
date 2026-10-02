class Retention::MembersService
  def initialize(account)
    @account = account
  end

  def show
    payload(memberships.to_a)
  end

  def update(user_ids:, revision:)
    @account.with_lock do
      records = memberships.lock.to_a
      raise CustomExceptions::Retention::StaleMembership.new({}) unless revision == revision_for(records)

      validate_members!(user_ids, records)
      records.each do |membership|
        selected = user_ids.include?(membership.user_id)
        membership.update!(retention_member: selected) if membership.retention_member? != selected
      end
      payload(records)
    end
  end

  private

  def memberships
    @account.account_users.includes(:user).order(:user_id)
  end

  def validate_members!(user_ids, records)
    allowed_ids = records.select { |membership| membership.user.confirmed? }.map(&:user_id)
    return if user_ids.is_a?(Array) && user_ids.all? { |id| id.is_a?(Integer) && allowed_ids.include?(id) }

    raise CustomExceptions::Retention::InvalidMembers.new({})
  end

  def revision_for(records)
    Digest::SHA256.hexdigest(records.map { |membership| [membership.user_id, membership.retention_member?] }.to_json)
  end

  def payload(records)
    {
      agents: records.select { |membership| membership.user.confirmed? || membership.retention_member? }.map do |membership|
        { id: membership.user_id, name: membership.user.name, confirmed: membership.user.confirmed? }
      end,
      user_ids: records.select(&:retention_member?).map(&:user_id),
      revision: revision_for(records)
    }
  end
end
