require 'rails_helper'

RSpec.describe Retention::SnapshotStore do
  describe '.secret' do
    it 'derives the same dedicated key from the shared server webhook secret when unset' do
      stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => '', 'CHATWOOT_EXTRA_WEBHOOK_SECRET' => 'shared-secret'))

      expected = OpenSSL::HMAC.hexdigest('SHA256', 'shared-secret', 'chatwoot-retention-snapshots-v1')
      expect(described_class.secret).to eq(expected)
      expect(described_class.signature('POST', '/internal/retention/snapshots/history', '123', '{}')).to eq(
        OpenSSL::HMAC.hexdigest('SHA256', expected,
                                "POST\n/internal/retention/snapshots/history\n123\n#{Digest::SHA256.hexdigest('{}')}")
      )
    end

    it 'prefers a dedicated retention secret when configured' do
      stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => 'dedicated', 'CHATWOOT_EXTRA_WEBHOOK_SECRET' => 'shared'))

      expect(described_class.secret).to eq('dedicated')
    end

    it 'fails closed when neither secret is configured' do
      stub_const('ENV', ENV.to_h.merge('CHATWOOT_RETENTION_SECRET' => '', 'CHATWOOT_EXTRA_WEBHOOK_SECRET' => ''))

      expect { described_class.secret }.to raise_error(described_class::Unavailable)
    end
  end
end
