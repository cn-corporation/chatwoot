require 'rails_helper'

RSpec.describe 'Retention workspace', type: :request do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:channel) { create(:channel_telegram, account: account) }
  let(:inbox) { create(:inbox, account: account, channel: channel) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox, additional_attributes: { chat_id: '123' }) }
  let(:headers) { agent.create_new_auth_token }
  let(:base) { "/api/v1/accounts/#{account.id}/retention" }
  let(:path) { "#{base}/conversations/#{conversation.display_id}" }

  let(:extra) { RetentionSnapshotStoreStub.new }

  before do
    stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => 'retention-test-secret',
                                     'CHATWOOT_EXTRA_API_URL' => 'http://retention-extra.test'))
    extra
    account.account_users.find_by!(user: agent).update!(retention_member: true)
    create(:inbox_member, inbox: inbox, user: agent)
  end

  def send_retention(content = 'Hello', request_id: SecureRandom.uuid, session_id: nil)
    post "#{path}/messages", headers: headers, params: { content: content, request_id: request_id, session_id: session_id }, as: :json
  end

  def delivered_retention_message(content = 'Hello')
    send_retention(content)
    message = conversation.reload.active_retention_session.messages.outgoing.last
    message.update!(source_id: '42')
    message
  end

  def message_path(message)
    "#{path}/messages/#{message.id}"
  end

  it 'edits a delivered specialist message once in Telegram and keeps its prior text for the snapshot' do
    message = delivered_retention_message
    telegram = stub_request(:post, "#{channel.telegram_api_url}/editMessageText")
               .to_return(status: 200, body: { ok: true, result: {} }.to_json, headers: { 'Content-Type' => 'application/json' })

    patch message_path(message), headers: headers,
                                 params: { session_id: message.retention_session_id, expected_content: 'Hello', content: 'Updated' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(telegram).to have_been_requested.once
    expect(message.reload.content).to eq('Updated')
    expect(message.content_attributes['retention_revisions'].last).to include('action' => 'edit', 'previous_content' => 'Hello')
    expect(response.parsed_body.dig('message', 'content')).to eq('Updated')

    patch message_path(message), headers: headers,
                                 params: { session_id: message.retention_session_id, expected_content: 'Hello', content: 'Stale' }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(telegram).to have_been_requested.once
    expect(message.reload.content).to eq('Updated')
  end

  it 'does not change local content when Telegram rejects an edit or deletion' do
    message = delivered_retention_message
    stub_request(:post, "#{channel.telegram_api_url}/editMessageText")
      .to_return(status: 400, body: { ok: false, description: 'message is too old' }.to_json,
                 headers: { 'Content-Type' => 'application/json' })
    stub_request(:post, "#{channel.telegram_api_url}/deleteMessage")
      .to_return(status: 400, body: { ok: false, description: 'message is too old' }.to_json,
                 headers: { 'Content-Type' => 'application/json' })

    patch message_path(message), headers: headers,
                                 params: { session_id: message.retention_session_id, expected_content: 'Hello', content: 'Updated' }, as: :json
    expect(response).to have_http_status(:bad_gateway)
    delete message_path(message), headers: headers,
                                  params: { session_id: message.retention_session_id, expected_content: 'Hello' }, as: :json
    expect(response).to have_http_status(:bad_gateway)
    expect(message.reload.content).to eq('Hello')
    expect(message.content_attributes).not_to have_key('retention_revisions')
  end

  it 'deletes a delivered message in Telegram, retains a revision tombstone and prevents retry' do
    message = delivered_retention_message
    telegram = stub_request(:post, "#{channel.telegram_api_url}/deleteMessage")
               .to_return(status: 200, body: { ok: true, result: true }.to_json, headers: { 'Content-Type' => 'application/json' })

    delete message_path(message), headers: headers,
                                  params: { session_id: message.retention_session_id, expected_content: 'Hello' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(telegram).to have_been_requested.once
    expect(message.reload.content).to be_nil
    expect(message.content_attributes['deleted']).to be(true)
    expect(message.content_attributes['retention_revisions'].last).to include('action' => 'delete', 'previous_content' => 'Hello')
    expect(response.parsed_body.dig('message', 'content_attributes', 'deleted')).to be(true)

    session = conversation.reload.active_retention_session
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    saved = extra.payload(session).fetch('messages').find { |item| item['id'] == message.id }
    expect(saved.dig('content_attributes', 'retention_revisions').last['previous_content']).to eq('Hello')

    post "#{message_path(message)}/retry", headers: headers
    expect(response).to have_http_status(:conflict)
  end

  it 'edits a delivered file caption through Telegram while keeping the attachment' do
    upload = fixture_file_upload(Rails.root.join('spec/assets/avatar.png'), 'image/png')
    post "#{path}/messages", headers: headers, params: { content: 'Caption', request_id: SecureRandom.uuid, attachments: [upload] }
    message = conversation.reload.active_retention_session.messages.outgoing.last
    message.update!(source_id: '43')
    telegram = stub_request(:post, "#{channel.telegram_api_url}/editMessageCaption")
               .to_return(status: 200, body: { ok: true, result: {} }.to_json, headers: { 'Content-Type' => 'application/json' })

    patch message_path(message), headers: headers,
                                 params: { session_id: message.retention_session_id, expected_content: 'Caption', content: 'New caption' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(telegram).to have_been_requested.once
    expect(message.reload.content).to eq('New caption')
    expect(message.attachments.count).to eq(1)
  end

  it 'rejects edits and deletions after the session closes or membership is removed' do
    message = delivered_retention_message
    session_id = message.retention_session_id
    account.account_users.find_by!(user: agent).update!(retention_member: false)
    patch message_path(message), headers: headers,
                                 params: { session_id: session_id, expected_content: 'Hello', content: 'Blocked' }, as: :json
    expect(response).to have_http_status(:unauthorized)
    delete message_path(message), headers: headers,
                                  params: { session_id: session_id, expected_content: 'Hello' }, as: :json
    expect(response).to have_http_status(:unauthorized)

    account.account_users.find_by!(user: agent).update!(retention_member: true)
    post "#{path}/complete", headers: headers, params: { session_id: session_id }, as: :json
    expect(response).to have_http_status(:ok)
    patch message_path(message), headers: headers,
                                 params: { session_id: session_id, expected_content: 'Hello', content: 'Too late' }, as: :json
    expect(response).to have_http_status(:conflict)
    delete message_path(message), headers: headers,
                                  params: { session_id: session_id, expected_content: 'Hello' }, as: :json
    expect(response).to have_http_status(:conflict)
  end

  it 'allows editing a failed local send and removes a failed file without contacting Telegram' do
    upload = fixture_file_upload(Rails.root.join('spec/assets/avatar.png'), 'image/png')
    post "#{path}/messages", headers: headers, params: { content: 'Caption', request_id: SecureRandom.uuid, attachments: [upload] }
    message = conversation.reload.active_retention_session.messages.outgoing.last
    message.update!(status: :failed)
    attachment = message.attachments.first
    edit_request = stub_request(:post, "#{channel.telegram_api_url}/editMessageCaption")
    delete_request = stub_request(:post, "#{channel.telegram_api_url}/deleteMessage")

    patch message_path(message), headers: headers,
                                 params: { session_id: message.retention_session_id, expected_content: 'Caption', content: 'New caption' }, as: :json
    expect(response).to have_http_status(:ok)
    delete message_path(message), headers: headers,
                                  params: { session_id: message.retention_session_id, expected_content: 'New caption' }, as: :json
    expect(response).to have_http_status(:ok)
    expect(message.reload.attachments).to be_empty
    expect(message.content_attributes['retention_revisions'].last['removed_attachments'].first).to include('id' => attachment.id,
                                                                                                           'content_type' => 'image/png')
    expect(edit_request).not_to have_been_requested
    expect(delete_request).not_to have_been_requested
  end

  it 'exposes capability only for selected members and requires membership for the workspace' do
    get "#{base}/capabilities", headers: headers
    expect(response.parsed_body).to eq('member' => true, 'unread_conversation_ids' => [])
    get "#{base}/conversations", headers: admin.create_new_auth_token
    expect(response).to have_http_status(:unauthorized)
  end

  it 'returns retention links and safe message previews through the native notifications API' do
    send_retention
    create(:message, conversation: conversation, message_type: :incoming, content: 'Native retention notification')
    get "/api/v1/accounts/#{account.id}/notifications", headers: headers
    expect(response).to have_http_status(:ok)
    notification = response.parsed_body.dig('data', 'payload').find { |item| item['retention_url'] }
    expect(notification['retention_url']).to eq("/app/accounts/#{account.id}/retention?conversation=#{conversation.display_id}")
    expect(notification['push_message_title']).to include('Native retention notification')
    expect(notification['primary_actor']).not_to have_key('messages')
  end

  it 'counts each unread active chat once and reads only the displayed session through its message watermark' do
    support = create(:notification, account: account, user: agent, primary_actor: conversation)
    send_retention
    session = conversation.reload.active_retention_session
    first = create(:message, conversation: conversation, message_type: :incoming, content: 'Displayed reply')
    second = create(:message, conversation: conversation, message_type: :incoming, content: 'Reply arriving after display')
    first_alert = Notification.find_by!(user: agent, secondary_actor: first)
    second_alert = Notification.find_by!(user: agent, secondary_actor: second)
    original = conversation.reload.attributes
    get "#{base}/capabilities", headers: headers
    expect(response.parsed_body['unread_conversation_ids']).to eq([conversation.display_id])

    post "#{path}/read", headers: headers, params: { session_id: session.id, last_message_id: first.id }, as: :json
    expect(response).to have_http_status(:ok)
    expect(first_alert.reload.read_at).to be_present
    expect(second_alert.reload.read_at).to be_nil
    expect(support.reload.read_at).to be_nil
    expect(conversation.reload.attributes).to eq(original)
    get "#{base}/capabilities", headers: headers
    expect(response.parsed_body['unread_conversation_ids']).to eq([conversation.display_id])

    post "#{path}/read", headers: headers, params: { session_id: session.id, last_message_id: second.id }, as: :json
    expect(response).to have_http_status(:ok)
    get "#{base}/capabilities", headers: headers
    expect(response.parsed_body['unread_conversation_ids']).to eq([])
  end

  it 'rejects stale-session and unauthorized reads while omitting completed sessions from the workspace counter' do
    send_retention
    session = conversation.reload.active_retention_session
    message = create(:message, conversation: conversation, message_type: :incoming)
    post "#{path}/read", headers: headers, params: { session_id: session.id + 1, last_message_id: message.id }, as: :json
    expect(response).to have_http_status(:not_found)
    post "#{path}/read", headers: admin.create_new_auth_token, params: { session_id: session.id, last_message_id: message.id }, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(Notification.find_by!(user: agent, secondary_actor: message).read_at).to be_nil

    session.messages.outgoing.last.update!(status: :sent, source_id: 'retention-counter-test-delivered')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    get "#{base}/capabilities", headers: headers
    expect(response.parsed_body['unread_conversation_ids']).to eq([])
  end

  it 'searches by Telegram username and previews without starting or changing the support conversation' do
    conversation.contact.update!(name: 'Customer', additional_attributes: { username: 'telegram_customer' })
    original = conversation.reload.attributes
    get "#{base}/conversations", headers: headers, params: { q: '@telegram_customer' }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.fetch('conversations').pluck('id')).to eq([conversation.display_id])
    get path, headers: headers
    expect(response).to have_http_status(:ok)
    expect(conversation.reload.attributes).to eq(original)
    expect(RetentionSession.count).to eq(0)
  end

  context 'when the last specialist is an administrator with an active session' do
    let(:admin_headers) { admin.create_new_auth_token }
    let(:session) { conversation.reload.active_retention_session }
    let(:start_status) do
      post "#{path}/messages", headers: admin_headers, params: { content: 'Retention only', request_id: SecureRandom.uuid }, as: :json
      response.status
    end

    before do
      account.account_users.find_by!(user: agent).update!(retention_member: false)
      account.account_users.find_by!(user: admin).update!(retention_member: true)
      create(:inbox_member, inbox: inbox, user: admin)
      start_status
      session
      get "#{base}/members", headers: admin_headers
      revision = response.parsed_body.fetch('revision')
      allow(ActionCableBroadcastJob).to receive(:perform_later)
      put "#{base}/members", headers: admin_headers, params: { user_ids: [], revision: revision }, as: :json
    end

    it 'allows their removal while preserving the isolated active session' do
      expect(start_status).to eq(200)
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['user_ids']).to eq([])
      expect(account.account_users.find_by!(user: admin)).not_to be_retention_member
      expect(conversation.reload.active_retention_session).to eq(session)
      expect(session.reload.completed_at).to be_nil
      expect(session.messages.count).to eq(1)
    end

    it 'broadcasts targeted revocation metadata' do
      expect(ActionCableBroadcastJob).to have_received(:perform_later).with(
        anything, 'retention.changed', account_id: account.id, user_id: admin.id, member: false
      )
    end

    it 'immediately denies workspace reads and writes without an administrator exemption' do
      get "#{base}/capabilities", headers: admin_headers
      expect(response.parsed_body).to eq('member' => false, 'unread_conversation_ids' => [])
      ["#{base}/conversations", path, "#{base}/history", "#{base}/snapshots/#{SecureRandom.uuid}"].each do |endpoint|
        get endpoint, headers: admin_headers
        expect(response).to have_http_status(:unauthorized)
      end
      post "#{path}/messages", headers: admin_headers,
                               params: { content: 'Forbidden', request_id: SecureRandom.uuid, session_id: session.id }, as: :json
      expect(response).to have_http_status(:unauthorized)
      post "#{path}/complete", headers: admin_headers, params: { session_id: session.id }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(session.messages.count).to eq(1)
    end

    it 'lets the administrator assign another specialist who can recover the same session' do
      get "#{base}/members", headers: admin_headers
      expect(response).to have_http_status(:ok)
      put "#{base}/members", headers: admin_headers,
                             params: { user_ids: [agent.id], revision: response.parsed_body.fetch('revision') }, as: :json
      expect(response).to have_http_status(:ok)
      get path, headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('conversation', 'session_id')).to eq(session.id)
    end
  end

  it 'atomically starts on the first send, retries idempotently and excludes the chat from support' do
    request_id = SecureRandom.uuid
    conversation
    expect { send_retention(request_id: request_id) }.to change(RetentionSession, :count).by(1)
    expect(response).to have_http_status(:ok)
    session = conversation.reload.active_retention_session
    expect(session.messages.count).to eq(1)
    expect(session.messages.first.workflow_epoch).to eq(1)
    expect { send_retention(request_id: request_id) }.not_to change(Message, :count)
    expect(response).to have_http_status(:ok)
    expect(Conversations::PermissionFilterService.new(account.conversations, agent, account).perform).not_to include(conversation)
    get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}", headers: admin.create_new_auth_token
    expect(response).to have_http_status(:unauthorized)
    expect(account.reporting_events.where(conversation: conversation)).to be_empty
  end

  it 'keeps incoming retention messages out of events, reporting and context, then captures immutable repeatable history' do
    history = create(:message, conversation: conversation, content: 'Earlier support')
    send_retention
    expect(response).to have_http_status(:ok)
    session = conversation.reload.active_retention_session
    outgoing = session.messages.outgoing.last
    delivery = stub_request(:post, "#{channel.telegram_api_url}/sendMessage")
               .to_return(status: 200, body: { ok: true, result: { message_id: 42 } }.to_json, headers: { 'Content-Type' => 'application/json' })
    SendReplyJob.perform_now(outgoing.id)
    SendReplyJob.perform_now(outgoing.id)
    expect(delivery).to have_been_requested.once
    expect(outgoing.reload.source_id).to eq('42')
    incoming = create(:message, conversation: conversation, message_type: :incoming, content: 'Retention reply')
    expect(incoming.retention_session_id).to eq(session.id)
    expect(conversation.reload).to be_resolved
    expect(Retention::EventGuard.allowed?({ message: incoming }, Time.current)).to be(false)
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    expect(conversation.reload).not_to be_retention_active
    expect(conversation).to be_resolved
    snapshot = extra.payload(session).deep_dup
    expect(Retention::SnapshotBuilder.digest(snapshot)).to eq(session.snapshot_digest)
    expect(snapshot['transcript_scope']).to eq('retention_session')
    expect(snapshot['messages'].pluck('id')).to eq([outgoing.id, incoming.id])
    expect(snapshot['messages'].pluck('id')).not_to include(history.id)
    incoming.update!(content: 'Changed later')
    expect(extra.payload(session)).to eq(snapshot)
    get "#{base}/snapshots/#{session.snapshot_id}", headers: headers
    expect(response.parsed_body.dig('snapshot', 'messages').find { |m| m['id'] == incoming.id }['content']).to eq('Retention reply')
    expect(session.update(snapshot_digest: 'changed')).to be(false)
    expect(RetentionSession.column_names).not_to include('snapshot')
    expect { send_retention('New retention session') }.to change(RetentionSession, :count).by(1)
    expect(response).to have_http_status(:ok)
  end

  it 'stores each session separately from earlier retention and intervening support messages' do
    send_retention('First session')
    first_session = conversation.reload.active_retention_session
    first_message = first_session.messages.outgoing.last
    first_message.update!(source_id: 'first_sent')
    post "#{path}/complete", headers: headers, params: { session_id: first_session.id }, as: :json
    expect(response).to have_http_status(:ok)
    first_snapshot = extra.payload(first_session).deep_dup

    support_message = create(:message, conversation: conversation.reload, message_type: :incoming, content: 'Support between sessions')
    send_retention('Second session')
    second_session = conversation.reload.active_retention_session
    second_message = second_session.messages.outgoing.last
    second_message.update!(source_id: 'second_sent')
    reply = create(:message, conversation: conversation, message_type: :incoming, content: 'Second session reply')
    # Attribution, rather than timestamps, must decide which transcript owns the message.
    support_message.update!(created_at: second_message.created_at)
    post "#{path}/complete", headers: headers, params: { session_id: second_session.id }, as: :json
    expect(response).to have_http_status(:ok)

    expect(extra.payload(first_session)).to eq(first_snapshot)
    expect(first_snapshot['messages'].pluck('id')).to eq([first_message.id])
    expect(extra.payload(second_session)['messages'].pluck('id')).to eq([second_message.id, reply.id])
    get "#{base}/snapshots/#{second_session.snapshot_id}", headers: headers
    expect(response.parsed_body.dig('snapshot', 'messages').pluck('id')).to eq([second_message.id, reply.id])
  end

  it 'rolls back a failed first send and a failed snapshot instead of stranding or releasing the chat' do
    original = conversation.reload.attributes
    send_retention('Hello', request_id: '-' * 36)
    expect(response).to have_http_status(:conflict)
    expect(conversation.reload.attributes).to eq(original)
    send_retention('x' * 150_001)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(conversation.reload.attributes).to eq(original)
    expect(RetentionSession.count).to eq(0)
    send_retention
    session = conversation.reload.active_retention_session
    session.messages.outgoing.last.update!(source_id: 'sent')
    allow_any_instance_of(Retention::SnapshotBuilder).to receive(:build).and_raise(Retention::Workflow::Conflict, 'snapshot failed')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:conflict)
    expect(conversation.reload).to be_retention_active
    expect(session.reload.completed_at).to be_nil
  end

  it 'suppresses stale support broadcasts and never delivers a failed message after its session closes' do
    send_retention
    session = conversation.reload.active_retention_session
    outgoing = session.messages.outgoing.last
    allow(ActionCable.server).to receive(:broadcast)
    payload = { id: conversation.display_id, account_id: account.id, workflow_epoch: 0 }
    ActionCableBroadcastJob.perform_now(['support-agent'], 'conversation.updated', payload)
    expect(ActionCable.server).not_to have_received(:broadcast)
    outgoing.update!(status: :failed)
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    expect(SendReplyJob::CHANNEL_SERVICES.fetch('Channel::Telegram')).not_to receive(:new)
    SendReplyJob.perform_now(outgoing.id)
    ActionCableBroadcastJob.perform_now(['support-agent'], 'conversation.updated', payload)
    expect(ActionCable.server).not_to have_received(:broadcast)
  end

  it 'rejects stale-session sends, pending delivery completion, and access after removal' do
    send_retention
    session = conversation.reload.active_retention_session
    send_retention('Stale browser tab')
    expect(response).to have_http_status(:conflict)
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:conflict)
    account.account_users.find_by!(user: agent).update!(retention_member: false)
    get path, headers: headers
    expect(response).to have_http_status(:unauthorized)
  end

  it 'fences external deliveries before takeover and rejects old generations after completion' do
    admin_headers = admin.create_new_auth_token
    post "#{base}/leases", headers: admin_headers, params: { conversation_id: conversation.display_id, workflow_epoch: 0 }, as: :json
    expect(response).to have_http_status(:ok)
    lease_id = response.parsed_body.fetch('leases').first
    send_retention
    expect(response).to have_http_status(:conflict)
    expect(conversation.reload).not_to be_retention_active
    delete "#{base}/leases/#{lease_id}", headers: admin_headers
    send_retention
    expect(response).to have_http_status(:ok)
    session = conversation.reload.active_retention_session
    session.messages.outgoing.last.update!(source_id: 'sent')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    post "#{base}/leases", headers: admin_headers, params: { conversation_id: conversation.display_id, workflow_epoch: 0 }, as: :json
    expect(response).to have_http_status(:conflict)
    post "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages",
         headers: admin_headers.merge('X-Chatwoot-Workflow-Epoch' => '0'), params: { content: 'stale automation' }, as: :json
    expect(response).to have_http_status(:conflict)
  end

  it 'keeps archived retention messages out of support exports, reports and future AI context' do
    send_retention
    session = conversation.reload.active_retention_session
    session.messages.outgoing.last.update!(source_id: 'sent')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    new_message = create(:message, conversation: conversation.reload, message_type: :incoming, content: 'New support issue')
    expect(new_message.retention_session_id).to be_nil
    expect(conversation.reload).to be_open
    expect(conversation.support_started_at).to be_present
    expect(Messages::ContextFetcherService.new(new_message).fetch_context_messages).to eq([new_message])
    expect(conversation.messages.support).not_to include(session.messages.first)
    get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages", headers: headers, params: { support_only: true }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.fetch('payload').pluck('id')).not_to include(session.messages.first.id)
  end

  it 'stores only session media metadata in Extra and keeps it when original files are removed' do
    support_message = create(:message, :with_attachment, account: account, conversation: conversation)
    send_retention
    session = conversation.reload.active_retention_session
    message = create(:message, :with_attachment, account: account, conversation: conversation, message_type: :incoming)
    blob = message.attachments.first.file.blob
    session.messages.outgoing.last.update!(source_id: 'sent')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    captured = extra.payload(session)
    attachment = captured['messages'].find { |item| item['id'] == message.id }['attachments'].first
    expect(captured).to include('schema_version' => 3, 'attachment_storage' => 'chatwoot')
    expect(attachment).to include('blob_id' => blob.id, 'filename' => blob.filename.to_s,
                                  'byte_size' => blob.byte_size, 'checksum' => blob.checksum, 'checksum_algorithm' => 'md5_base64')
    expect(attachment).not_to have_key('file_id')
    expect(extra.files).to be_empty
    get "#{base}/snapshots/#{session.snapshot_id}", headers: headers
    displayed = response.parsed_body['snapshot']['messages'].find { |item| item['id'] == message.id }['attachments'].first
    get displayed['data_url']
    expect(response).to have_http_status(:ok)
    expect(response.body.b).to eq(blob.download)
    message.attachments.destroy_all
    get displayed['data_url']
    expect(response).to have_http_status(:not_found)
    get "#{base}/snapshots/#{session.snapshot_id}", headers: headers
    tombstone = response.parsed_body['snapshot']['messages'].find { |item| item['id'] == message.id }['attachments'].first
    expect(tombstone).to include('available' => false, 'filename' => blob.filename.to_s, 'checksum' => blob.checksum)
    expect(tombstone).not_to have_key('data_url')
    expect(extra.payload(session)).to eq(captured)
    expect(captured['messages'].pluck('id')).not_to include(support_message.id)
    expect(ActiveStorage::Attachment.where(record_type: 'RetentionSession')).to be_empty
    outsider = create(:user, account: create(:account))
    get "#{base}/snapshots/#{session.snapshot_id}", headers: outsider.create_new_auth_token
    expect(response).to have_http_status(:unauthorized)
  end

  it 'accepts files without text, splits delivery states and deduplicates the whole upload batch' do
    upload = -> { fixture_file_upload(Rails.root.join('spec/assets/avatar.png'), 'image/png') }
    request_id = SecureRandom.uuid
    params = { content: '', request_id: request_id, attachments: [upload.call, upload.call] }
    post "#{path}/messages", headers: headers, params: params
    expect(response).to have_http_status(:ok)
    session = conversation.reload.active_retention_session
    expect(session.messages.count).to eq(2)
    expect(session.messages.map { |message| message.attachments.size }).to eq([1, 1])
    params[:attachments] = [upload.call, upload.call]
    expect { post "#{path}/messages", headers: headers, params: params }.not_to change(Message, :count)
    expect(response).to have_http_status(:ok)
    params[:content] = 'Different caption'
    post "#{path}/messages", headers: headers, params: params
    expect(response).to have_http_status(:conflict)
    delivery = stub_request(:post, "#{channel.telegram_api_url}/sendPhoto")
               .with { |request| request.body.include?('filename="avatar.png"') }
               .to_return(status: 200, body: { ok: true, result: { message_id: 87 } }.to_json, headers: { 'Content-Type' => 'application/json' })
    session.messages.each { |message| SendReplyJob.perform_now(message.id) }
    expect(delivery).to have_been_requested.twice
    expect(session.messages.reload.pluck(:source_id)).to eq(%w[87 87])
    expect(account.reporting_events.where(conversation: conversation)).to be_empty
  end

  it 'validates uploads before starting and serves live media on the current origin with byte ranges and current inbox access' do
    params = { request_id: SecureRandom.uuid, attachments: ['a signed blob from another account'] }
    post "#{path}/messages", headers: headers, params: params, as: :json
    expect(response).to have_http_status(:conflict)
    expect(conversation.reload.active_retention_session_id).to be_nil
    send_retention
    message = create(:message, :with_attachment, account: account, conversation: conversation, message_type: :incoming)
    get path, headers: headers
    item = response.parsed_body['messages'].find { |record| record['id'] == message.id }['attachments'].first
    expect(item['data_url']).to start_with('/retention/media/')
    get item['data_url'], headers: { 'Range' => 'bytes=0-3' }
    expect(response).to have_http_status(:partial_content)
    expect(response.body.b).to eq(message.attachments.first.file.blob.download.byteslice(0, 4))
    expect(response.headers['Cache-Control']).to eq('no-store')
    inbox.inbox_members.find_by!(user: agent).destroy!
    get item['data_url']
    expect(response).to have_http_status(:unauthorized)
  end

  it 'delivers documents, audio and video as Telegram multipart uploads without a public file host' do
    files = [['sample.pdf', 'application/pdf', 'sendDocument'], ['sample.mp3', 'audio/mpeg', 'sendAudio'],
             ['sample.mp4', 'video/mp4', 'sendVideo']]
    uploads = files.map { |name, mime, _| fixture_file_upload(Rails.root.join('spec/assets', name), mime) }
    post "#{path}/messages", headers: headers,
                             params: { content: 'Files', request_id: SecureRandom.uuid, attachments: uploads }
    expect(response).to have_http_status(:ok)
    messages = conversation.reload.active_retention_session.messages.reorder(:id).to_a
    expect(messages.pluck(:content)).to eq(['Files', nil, nil])
    files.each do |name, _, endpoint|
      delivery = stub_request(:post, "#{channel.telegram_api_url}/#{endpoint}")
                 .with { |request| request.body.include?("filename=\"#{name}\"") }
                 .to_return(status: 200, body: { ok: true, result: { message_id: 88 } }.to_json,
                            headers: { 'Content-Type' => 'application/json' })
      SendReplyJob.perform_now(messages.shift.id)
      expect(delivery).to have_been_requested.once
    end
  end

  it 'leaves the session active when Extra fails before durable snapshot storage' do
    send_retention
    session = conversation.reload.active_retention_session
    session.messages.outgoing.last.update!(source_id: 'sent')
    extra.fail_prepare = true
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:service_unavailable)
    expect(conversation.reload).to be_retention_active
    expect(session.reload.snapshot_id).to be_nil
    expect(session.completed_at).to be_nil
  end

  it 'recovers a lost acknowledgment without releasing another session or creating another capture' do
    send_retention
    session = conversation.reload.active_retention_session
    session.messages.outgoing.last.update!(source_id: 'sent')
    extra.fail_commit = true
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    expect(conversation.reload).not_to be_retention_active
    expect(extra.payload(session)['messages'].size).to eq(1)
    expect(session.reload.snapshot_synced_at).to be_nil
    expect(response.parsed_body['snapshot_pending']).to be(true)
    extra.fail_commit = false
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    expect(response).to have_http_status(:ok)
    expect(extra.snapshots.size).to eq(1)
    expect(session.reload.snapshot_synced_at).to be_present
  end

  it 'revokes previously issued attachment URLs when membership is removed' do
    send_retention
    session = conversation.reload.active_retention_session
    create(:message, :with_attachment, account: account, conversation: conversation, message_type: :incoming)
    session.messages.outgoing.last.update!(source_id: 'sent')
    post "#{path}/complete", headers: headers, params: { session_id: session.id }, as: :json
    get "#{base}/snapshots/#{session.reload.snapshot_id}", headers: headers
    attachment = response.parsed_body['snapshot']['messages'].flat_map { |item| item['attachments'] }.first
    get attachment['data_url']
    expect(response).to have_http_status(:ok)
    expect(response.headers['Cache-Control']).to eq('no-store')
    account.account_users.find_by!(user: agent).update!(retention_member: false)
    get attachment['data_url']
    expect(response).to have_http_status(:unauthorized)
  end
end
