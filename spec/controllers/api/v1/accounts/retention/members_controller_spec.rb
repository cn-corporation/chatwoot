require 'rails_helper'

RSpec.describe 'Retention members API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account) }
  let(:path) { "/api/v1/accounts/#{account.id}/retention/members" }
  let(:headers) { admin.create_new_auth_token }

  def saved_revision
    get path, headers: headers
    response.parsed_body.fetch('revision')
  end

  it 'requires authentication and administrator access for both reads and writes' do
    get path
    expect(response).to have_http_status(:unauthorized)

    get path, headers: agent.create_new_auth_token
    expect(response).to have_http_status(:unauthorized)

    put path, headers: agent.create_new_auth_token, params: { user_ids: [agent.id], revision: 'stale' }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(account.account_users.where(retention_member: true)).to be_empty
  end

  it 'does not allow an administrator from another account to read or change membership' do
    outsider = create(:user, account: create(:account), role: :administrator)
    outsider_headers = outsider.create_new_auth_token

    get path, headers: outsider_headers
    expect(response).to have_http_status(:unauthorized)

    put path, headers: outsider_headers, params: { user_ids: [outsider.id], revision: 'stale' }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(account.account_users.where(retention_member: true)).to be_empty
  end

  it 'lists verified account users and restores the saved selection' do
    membership = account.account_users.find_by!(user: agent)
    membership.update!(retention_member: true)
    unconfirmed = create(:user, account: account, skip_confirmation: false)
    outsider = create(:user)

    get path, headers: headers

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['user_ids']).to eq([agent.id])
    expect(response.parsed_body['agents'].pluck('id')).to contain_exactly(admin.id, agent.id)
    expect(response.parsed_body['agents'].pluck('id')).not_to include(unconfirmed.id, outsider.id)
    expect(response.parsed_body['revision']).to be_present
  end

  it 'saves and clears specialists without changing roles, availability or another account membership' do
    membership = account.account_users.find_by!(user: agent)
    other_membership = create(:account_user, user: agent, retention_member: true)
    original_attributes = membership.attributes.slice('role', 'availability', 'auto_offline')
    revision = saved_revision

    put path, headers: headers, params: { user_ids: [agent.id, admin.id], revision: revision }, as: :json

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['user_ids']).to contain_exactly(agent.id, admin.id)
    expect(membership.reload).to be_retention_member
    expect(membership.attributes.slice('role', 'availability', 'auto_offline')).to eq(original_attributes)

    put path, headers: headers, params: { user_ids: [], revision: response.parsed_body['revision'] }, as: :json

    expect(response).to have_http_status(:ok)
    expect(account.account_users.where(retention_member: true)).to be_empty
    expect(other_membership.reload).to be_retention_member
  end

  it 'rejects invalid or unverified users atomically and preserves the previous selection' do
    membership = account.account_users.find_by!(user: agent)
    membership.update!(retention_member: true)
    outsider = create(:user)
    unconfirmed = create(:user, account: account, skip_confirmation: false)
    revision = saved_revision

    [[admin.id, outsider.id], [unconfirmed.id], [agent.id.to_s], nil, 'all'].each do |user_ids|
      put path, headers: headers, params: { user_ids: user_ids, revision: revision }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(account.account_users.where(retention_member: true).pluck(:user_id)).to eq([agent.id])
    end
  end

  it 'rejects a stale save instead of overwriting another administrator' do
    agent
    revision = saved_revision
    put path, headers: headers, params: { user_ids: [agent.id], revision: revision }, as: :json
    expect(response).to have_http_status(:ok)

    put path, headers: headers, params: { user_ids: [admin.id], revision: revision }, as: :json

    expect(response).to have_http_status(:conflict)
    expect(account.account_users.where(retention_member: true).pluck(:user_id)).to eq([agent.id])
  end

  it 'requires a revision and an explicit user list rather than treating missing input as a clear action' do
    account.account_users.find_by!(user: agent).update!(retention_member: true)
    revision = saved_revision

    put path, headers: headers, params: { revision: revision }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)

    put path, headers: headers, params: { user_ids: [] }, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(account.account_users.where(retention_member: true).pluck(:user_id)).to eq([agent.id])
  end
end
