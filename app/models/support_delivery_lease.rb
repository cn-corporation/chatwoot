# == Schema Information
#
# Table name: support_delivery_leases
#
#  id              :uuid             not null, primary key
#  expires_at      :datetime         not null
#  conversation_id :bigint           not null
#
# Indexes
#
#  index_support_delivery_leases_on_conversation_id  (conversation_id)
#  index_support_delivery_leases_on_expires_at       (expires_at)
#
# Foreign Keys
#
#  fk_rails_...  (conversation_id => conversations.id) ON DELETE => cascade
#
class SupportDeliveryLease < ApplicationRecord
  belongs_to :conversation
  scope :live, -> { where('expires_at > ?', Time.current) }
end
