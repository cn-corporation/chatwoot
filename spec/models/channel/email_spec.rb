# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join 'spec/models/concerns/reauthorizable_shared.rb'

RSpec.describe Channel::Email do
  let(:channel) { create(:channel_email) }

  describe 'concerns' do
    it_behaves_like 'reauthorizable'
  end

  it 'has a valid name' do
    expect(channel.name).to eq('Email')
  end

  context 'when microsoft?' do
    it 'returns false' do
      expect(channel.microsoft?).to be(false)
    end

    it 'returns true' do
      channel.provider = 'microsoft'
      expect(channel.microsoft?).to be(true)
    end
  end

  context 'when google?' do
    it 'returns false' do
      expect(channel.google?).to be(false)
    end

    it 'returns true' do
      channel.provider = 'google'
      expect(channel.google?).to be(true)
    end
  end
end
