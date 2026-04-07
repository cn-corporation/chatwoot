class AccountPolicy < ApplicationPolicy
  def show?
    @account_user.administrator? || @account_user.agent?
  end

  def cache_keys?
    @account_user.administrator? || @account_user.agent?
  end

  def limits?
    @account_user.administrator? || @account_user.agent?
  end

  def update?
    @account_user.administrator?
  end

  def update_active_at?
    true
  end

  def toggle_support_line?
    return true if @account_user.administrator?
    return false unless @account_user.agent?

    user = @account_user.user
    account = @account_user.account
    support_team_id = account.settings&.dig('support_247_team_id')
    return false if support_team_id.blank?

    user_team_ids = user.teams.where(account_id: account.id).pluck(:id)
    user_team_ids.empty? || user_team_ids.include?(support_team_id)
  end

  def subscription?
    @account_user.administrator?
  end

  def checkout?
    @account_user.administrator?
  end

  def toggle_deletion?
    @account_user.administrator?
  end
end
