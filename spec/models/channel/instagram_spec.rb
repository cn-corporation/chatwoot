# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join 'spec/models/concerns/reauthorizable_shared.rb'

RSpec.describe Channel::Instagram do
  let(:channel) { create(:channel_instagram) }

  it { is_expected.to validate_presence_of(:account_id) }
  it { is_expected.to validate_presence_of(:access_token) }
  it { is_expected.to validate_presence_of(:instagram_id) }
  it { is_expected.to belong_to(:account) }
  it { is_expected.to have_one(:inbox).dependent(:destroy_async) }

  it 'has a valid name' do
    expect(channel.name).to eq('Instagram')
  end

  describe 'concerns' do
    it_behaves_like 'reauthorizable'
  end
end
