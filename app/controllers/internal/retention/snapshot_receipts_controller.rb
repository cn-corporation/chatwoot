class Internal::Retention::SnapshotReceiptsController < ApplicationController
  def create
    unless Retention::SnapshotStore.valid_request?(request)
      return render json: { error: 'Invalid retention service signature' }, status: :unauthorized
    end
    unless params[:source_id] == Retention::SnapshotStore.source_id && params[:sessions].is_a?(Array) && params[:sessions].size <= 100
      return render json: { error: 'Invalid receipt lookup' }, status: :bad_request
    end

    receipts = params[:sessions].map { |identity| receipt_for(identity) }
    render json: { sessions: receipts }
  end

  private

  def receipt_for(identity)
    session = RetentionSession.find_by(account_id: identity[:account_id], id: identity[:session_id])
    {
      account_id: identity[:account_id].to_i, session_id: identity[:session_id].to_i,
      completed_at: session&.completed_at, snapshot_id: session&.snapshot_id, digest: session&.snapshot_digest
    }
  end
end
