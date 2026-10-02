require 'rails_helper'

RSpec.describe Retention::NotificationService do
  let(:account) { create(:account) }
  let(:specialist) { create(:user, account: account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:channel) { create(:channel_telegram, account: account) }
  let(:conversation) { create(:conversation, account: account, inbox: channel.inbox) }
  let(:session) { Retention::EntryService.new(conversation.reload).perform(source: 'telegram_start', parameter: 'rtn') }
  let(:incoming) do
    session
    conversation.messages.create!(account: account, inbox: conversation.inbox, sender: conversation.contact,
                                  content: 'Retention customer reply', message_type: :incoming)
  end

  before do
    create(:inbox_member, inbox: conversation.inbox, user: specialist)
    account.account_users.find_by!(user: specialist).update!(retention_member: true)
  end

  it 'uses the native bell with only selected inbox-authorized specialists and idempotent delivery' do
    incoming
    described_class.new(incoming).perform
    notifications = Notification.where(secondary_actor: incoming)
    expect(notifications.pluck(:user_id)).to eq([specialist.id])
    expect(notifications.first.meta['retention_session_id']).to eq(session.id)
    payload = notifications.first.push_event_data
    expect(payload[:retention_url]).to include('/retention?conversation=')
    expect(payload[:primary_actor]).not_to have_key(:messages)
    expect(NotificationFinder.new(specialist, account).unread_count).to eq(1)
    expect(NotificationFinder.new(admin, account).unread_count).to eq(0)
  end

  it 'does not notify specialists without access to the inbox or on specialist sends' do
    outsider = create(:user, account: account)
    account.account_users.find_by!(user: outsider).update!(retention_member: true)
    incoming
    expect(Notification.where(secondary_actor: incoming).pluck(:user_id)).to eq([specialist.id])
    sent = Retention::Workflow.new(conversation, specialist).send_message(content: 'Specialist response',
                                                                          request_id: SecureRandom.uuid, session_id: session.id)
    expect(Notification.where(secondary_actor: sent)).to be_empty
  end

  it 'broadcasts content-free chat changes only to selected inbox-authorized specialists' do
    outsider = create(:user, account: account)
    account.account_users.find_by!(user: outsider).update!(retention_member: true)
    session
    allow(ActionCableBroadcastJob).to receive(:perform_later).and_call_original
    message = incoming
    message.update!(content: 'Edited retention reply')
    expect(ActionCableBroadcastJob).to have_received(:perform_later).with(
      [specialist.pubsub_token], 'retention.changed',
      account_id: account.id, conversation_id: conversation.display_id
    ).twice
  end

  it 'removes retained alerts and stops queued pushes and broadcasts immediately on membership revocation' do
    incoming
    notification = Notification.find_by!(secondary_actor: incoming, user: specialist)
    data = { account_id: account.id, notification: notification.push_event_data }
    allow(ActionCable.server).to receive(:broadcast)
    allow(Notification::PushNotificationService).to receive(:new).and_call_original
    service = Notification::PushNotificationService.new(notification: notification)
    allow(service).to receive(:send_browser_push)
    account.account_users.find_by!(user: specialist).update!(retention_member: false)
    expect(Notification.exists?(notification.id)).to be(false)
    expect(NotificationFinder.new(specialist, account).unread_count).to eq(0)
    service.perform
    ActionCableBroadcastJob.perform_now([specialist.pubsub_token], 'notification.created', data)
    expect(service).not_to have_received(:send_browser_push)
    expect(ActionCable.server).not_to have_received(:broadcast)
  end

  it 'hides queued alerts after inbox access is removed without relying on deleting records' do
    incoming
    notification = Notification.find_by!(secondary_actor: incoming, user: specialist)
    conversation.inbox.inbox_members.where(user: specialist).destroy_all
    expect(notification.delivery_allowed?).to be(false)
    expect(NotificationFinder.new(specialist, account).notifications).to be_empty
  end
end
