require 'rails_helper'

RSpec.describe 'Telegram retention entry' do
  let(:channel) { create(:channel_telegram) }
  let(:account) { channel.account }
  let(:inbox) { channel.inbox }
  let(:specialist) { create(:user, account: account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:extra) { RetentionSnapshotStoreStub.new }

  before do
    stub_request(:any, /api.telegram.org/).to_return(status: 200, body: '{}', headers: { 'Content-Type' => 'application/json' })
    stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => 'retention-test-secret',
                                     'CHATWOOT_EXTRA_API_URL' => 'http://retention-extra.test'))
    extra
    create(:inbox_member, inbox: inbox, user: specialist)
    account.account_users.find_by!(user: specialist).update!(retention_member: true)
  end

  def receive_text(text, id: 1)
    params = { message: { message_id: id, text: text, date: Time.current.to_i,
                          from: { id: 782, first_name: 'Customer', username: 'customer' }, chat: { id: 782, type: 'private' } } }
    Telegram::IncomingMessageService.new(inbox: inbox, params: params.with_indifferent_access).perform
    inbox.conversations.order(:id).first.reload
  end

  it 'enters retention before publishing a new conversation or launch message to support' do
    support_team = create(:team, account: account)
    account.update!(settings: { support_247_team_id: support_team.id })
    conversation = receive_text('/start rtn')
    session = conversation.active_retention_session
    expect(conversation).to be_retention_active
    expect(conversation.team_id).to be_nil
    expect(Conversation.support.exists?(conversation.id)).to be(false)
    expect(session.started_by).to be_nil
    expect(session.entry_source).to eq('telegram_start')
    expect(session.entry_parameter).to eq('rtn')
    expect(session.messages.pluck(:content)).to eq(['/start rtn'])
    expect(inbox.messages.support.count).to eq(0)
    expect(account.reporting_events.count).to eq(0)
    expect(account.notifications.where(user: admin)).to be_empty
  end

  it 'moves an existing conversation immediately and keeps later customer replies in the same session' do
    conversation = receive_text('Support first')
    original_id = conversation.id
    conversation = receive_text('/start rtn', id: 2)
    receive_text('Retention reply', id: 3)
    expect(conversation.id).to eq(original_id)
    expect(conversation.active_retention_session.messages.pluck(:content)).to eq(['/start rtn', 'Retention reply'])
    expect(conversation.messages.support.pluck(:content)).to eq(['Support first'])
  end

  it 'deduplicates launch updates even after completion and creates a new session for a later launch' do
    conversation = receive_text('/start rtn')
    first = conversation.active_retention_session
    receive_text('/start rtn')
    receive_text('/start rtn', id: 2)
    expect(conversation.retention_sessions.count).to eq(1)
    expect(first.messages.count).to eq(2)
    Retention::Workflow.new(conversation, specialist).complete(session_id: first.id)
    Retention::FinalizeSnapshotJob.perform_now(first.id)
    receive_text('/start rtn')
    expect(conversation.reload).not_to be_retention_active
    receive_text('/start rtn', id: 3)
    expect(conversation.reload.active_retention_session_id).not_to eq(first.id)
    expect(extra.payload(first)['messages'].pluck('source_id')).to eq(%w[1 2])
    expect(extra.payload(first)['started_by']['id']).to be_nil
  end

  it 'leaves ordinary /start and other payloads in the normal workflow' do
    conversation = receive_text('/start')
    receive_text('/start rtn_other', id: 2)
    expect(conversation.reload).not_to be_retention_active
    expect(conversation.messages.support.count).to eq(2)
    expect(conversation.retention_sessions).to be_empty
  end

  it 'retains launches with no currently selected specialists' do
    account.account_users.find_by!(user: specialist).update!(retention_member: false)
    conversation = receive_text('/start rtn')
    expect(conversation).to be_retention_active
    expect(account.notifications.where("meta ? 'retention_session_id'")).to be_empty
  end

  it 'retries instead of admitting a retention launch into support while a delivery lease is live' do
    conversation = receive_text('Support first')
    lease = SupportDeliveryLease.create!(conversation: conversation, expires_at: 1.minute.from_now)
    expect { receive_text('/start rtn', id: 2) }.to raise_error(Retention::Workflow::Conflict)
    expect(conversation.messages.where(source_id: '2')).to be_empty
    lease.destroy!
    expect(receive_text('/start rtn', id: 2)).to be_retention_active
  end
end
