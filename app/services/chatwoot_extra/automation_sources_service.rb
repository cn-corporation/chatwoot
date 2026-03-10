module ChatwootExtra
  class AutomationSourcesService
    class << self
      def get_sources(automation_id)
        fetch_from_api(automation_id)
      rescue StandardError => e
        Rails.logger.error "[AutomationSourcesService] Error: #{e.message}"
        raise
      end

      private

      def fetch_from_api(automation_id)
        client = ChatwootExtra::ApiClient.new
        response = client.get_all_automations

        return [] if response.blank?

        automations = response['data']
        return [] if automations.blank?

        automation = automations.find { |a| a['chatwootAutomationId'] == automation_id }
        return [] if automation.blank? || automation['sources'].blank?

        automation['sources'].map { |s| s['chatwootChannelId'] }
      end
    end
  end
end
