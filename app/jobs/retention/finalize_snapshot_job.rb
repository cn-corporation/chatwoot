class Retention::FinalizeSnapshotJob < ApplicationJob
  queue_as :critical
  retry_on Retention::SnapshotStore::Unavailable, wait: :polynomially_longer, attempts: 20

  def perform(session_id)
    session = RetentionSession.find_by(id: session_id)
    return unless session&.completed_at? && session.snapshot_id.present? && session.snapshot_synced_at.nil?

    Retention::SnapshotStore.new.commit(session)
    session.update_column(:snapshot_synced_at, Time.current) # rubocop:disable Rails/SkipsModelValidations
  end
end
