require 'rails_helper'

RSpec.describe Retention::SnapshotStore, :extra_integration do
  # Run against an explicitly started isolated Extra storage server, never the development archive.
  before do
    skip 'Set RETENTION_TEST_EXTRA_URL to the isolated storage server' unless ENV['RETENTION_TEST_EXTRA_URL']
    WebMock.disable_net_connect!(allow_localhost: true)
    stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => 'retention-cross-service-test',
                                     'CHATWOOT_EXTRA_API_URL' => ENV.fetch('RETENTION_TEST_EXTRA_URL')))
  end

  it 'captures Rails data and media metadata in real Extra PostgreSQL without copying files' do
    account = create(:account)
    user = create(:user, account: account)
    channel = create(:channel_telegram, account: account)
    conversation = create(:conversation, account: account, inbox: channel.inbox).reload
    create(:inbox_member, inbox: channel.inbox, user: user)
    account.account_users.find_by!(user: user).update!(retention_member: true)
    session = Retention::EntryService.new(conversation).perform(source: 'telegram_start', parameter: 'rtn')
    message = create(:message, :with_attachment, account: account, conversation: conversation,
                                                 message_type: :incoming, content: 'Только удержание 😀')
    blob = message.attachments.first.file.blob
    Retention::Workflow.new(conversation, user).complete(session_id: session.id)
    Retention::FinalizeSnapshotJob.perform_now(session.id)
    session.reload
    expect(session.snapshot_synced_at).to be_present
    expect(conversation.reload).to be_resolved
    expect(RetentionSession.column_names).not_to include('snapshot')
    store = described_class.new
    scope = { account_id: account.id, inbox_ids: [channel.inbox.id], id: session.snapshot_id }
    stored = store.read(**scope)
    expect(Digest::SHA256.hexdigest(stored['payload_json'])).to eq(session.snapshot_digest)
    expect(stored['snapshot']['messages'].pluck('content')).to eq(['Только удержание 😀'])
    attachment = stored['snapshot']['messages'].first['attachments'].first
    expect(stored['snapshot']).to include('schema_version' => 3, 'attachment_storage' => 'chatwoot')
    expect(attachment).to include('blob_id' => blob.id, 'checksum' => blob.checksum, 'filename' => blob.filename.to_s)
    expect(attachment).not_to have_key('file_id')
    message.attachments.destroy_all
    expect(store.read(**scope)['payload_json']).to eq(stored['payload_json'])
    expect(store.history(account_id: account.id, inbox_ids: [channel.inbox.id], page: 1, query: '')['sessions'].pluck('id'))
      .to include(session.snapshot_id)
    expect { store.read(**scope, inbox_ids: []) }.to raise_error(described_class::NotFound)
  end

  it 'persists edit and delete revisions in the immutable Extra snapshot' do
    account = create(:account)
    user = create(:user, account: account)
    channel = create(:channel_telegram, account: account)
    conversation = create(:conversation, account: account, inbox: channel.inbox, additional_attributes: { chat_id: '123' }).reload
    create(:inbox_member, inbox: channel.inbox, user: user)
    account.account_users.find_by!(user: user).update!(retention_member: true)
    session = Retention::EntryService.new(conversation).perform(started_by: user)
    workflow = Retention::Workflow.new(conversation, user)
    message = workflow.send_message(content: 'Original', request_id: SecureRandom.uuid, session_id: session.id)
    message.update!(source_id: '42')
    stub_request(:post, "#{channel.telegram_api_url}/editMessageText")
      .to_return(status: 200, body: { ok: true, result: {} }.to_json, headers: { 'Content-Type' => 'application/json' })
    stub_request(:post, "#{channel.telegram_api_url}/deleteMessage")
      .to_return(status: 200, body: { ok: true, result: true }.to_json, headers: { 'Content-Type' => 'application/json' })

    workflow.edit_message(message_id: message.id, session_id: session.id, content: 'Edited', expected_content: 'Original')
    workflow.delete_message(message_id: message.id, session_id: session.id, expected_content: 'Edited')
    workflow.complete(session_id: session.id)
    Retention::FinalizeSnapshotJob.perform_now(session.id)
    stored = described_class.new.read(account_id: account.id, inbox_ids: [channel.inbox.id], id: session.reload.snapshot_id)
    saved = stored.fetch('snapshot').fetch('messages').find { |item| item['id'] == message.id }

    expect(saved.dig('content_attributes', 'deleted')).to be(true)
    expect(saved.dig('content_attributes', 'retention_revisions').pluck('action')).to eq(%w[edit delete])
    expect(saved.dig('content_attributes', 'retention_revisions').pluck('previous_content')).to eq(%w[Original Edited])
    expect(Digest::SHA256.hexdigest(stored['payload_json'])).to eq(session.snapshot_digest)
  end
end
