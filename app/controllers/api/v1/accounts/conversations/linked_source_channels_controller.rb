class Api::V1::Accounts::Conversations::LinkedSourceChannelsController < Api::V1::Accounts::Conversations::BaseController
  def index
    @linked_channels = LinkedSourceChannelFinder.new(@conversation).perform
    render json: { linked_channels: @linked_channels }
  end
end
