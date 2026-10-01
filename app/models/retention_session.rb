# == Schema Information
#
# Table name: retention_sessions
#
#  id                 :bigint           not null, primary key
#  completed_at       :datetime
#  entry_parameter    :string
#  entry_source       :string           default("manual"), not null
#  snapshot_digest    :string
#  snapshot_synced_at :datetime
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  account_id         :bigint           not null
#  completed_by_id    :bigint
#  conversation_id    :bigint           not null
#  snapshot_id        :uuid
#  started_by_id      :bigint
#
# Indexes
#
#  index_retention_sessions_on_account_id                   (account_id)
#  index_retention_sessions_on_account_id_and_completed_at  (account_id,completed_at)
#  index_retention_sessions_on_conversation_id              (conversation_id)
#  index_retention_sessions_on_snapshot_id                  (snapshot_id) UNIQUE
#  index_retention_sessions_one_active                      (conversation_id) UNIQUE WHERE (completed_at IS NULL)
#
# Foreign Keys
#
#  fk_rails_...  (account_id => accounts.id)
#  fk_rails_...  (conversation_id => conversations.id)
#
class RetentionSession < ApplicationRecord
  belongs_to :account
  belongs_to :conversation
  belongs_to :started_by, class_name: 'User', optional: true
  belongs_to :completed_by, class_name: 'User', optional: true
  has_many :messages, dependent: :restrict_with_error

  scope :active, -> { where(completed_at: nil) }
  scope :completed, -> { where.not(completed_at: nil) }

  validates :entry_source, inclusion: { in: %w[manual telegram_start] }
  validates :started_by, presence: true, if: -> { entry_source == 'manual' }
  validates :snapshot_id, :snapshot_digest, :completed_by_id, presence: true, if: :completed_at?
  validate :preserve_completed_session, on: :update
  after_commit :broadcast_change, on: [:create, :update]
  after_update_commit :finalize_snapshot, if: -> { saved_change_to_completed_at? && snapshot_id.present? }

  def summary
    {
      id: snapshot_id, source_session_id: id, conversation_id: conversation.display_id, created_at: created_at,
      completed_at: completed_at, started_by: started_by&.name,
      contact: conversation.contact.slice(:id, :name, :additional_attributes),
      inbox: conversation.inbox.slice(:id, :name),
      snapshot_digest: snapshot_digest
    }
  end

  private

  def finalize_snapshot
    Retention::FinalizeSnapshotJob.perform_later(id)
  end

  def broadcast_change
    ActionCableBroadcastJob.perform_later(account.users.pluck(:pubsub_token), 'retention.changed',
                                          account_id: account_id, conversation_id: conversation.display_id,
                                          active: completed_at.nil?)
    state = conversation.reload
    payload = { event: 'retention_changed', id: state.display_id, account_id: account_id,
                account: { id: account_id }, workflow_epoch: state.workflow_epoch, retention_active: state.retention_active? }
    account.webhooks.account_type.each do |webhook|
      next unless webhook.subscriptions.include?('message_created_with_context')

      WebhookJob.perform_later(webhook.url, payload)
    end
  end

  def preserve_completed_session
    errors.add(:base, I18n.t('retention.errors.immutable')) if completed_at_in_database.present?
  end
end
