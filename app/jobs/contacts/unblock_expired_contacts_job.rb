class Contacts::UnblockExpiredContactsJob < ApplicationJob
  queue_as :scheduled_jobs

  def perform
    Contact.where('blocked_until < ?', Time.current).where.not(blocked_until: nil).find_each(batch_size: 100) do |contact|
      contact.update!(blocked_until: nil)
    end
  end
end
