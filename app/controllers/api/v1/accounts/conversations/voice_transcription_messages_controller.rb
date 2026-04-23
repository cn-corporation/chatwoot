class Api::V1::Accounts::Conversations::VoiceTranscriptionMessagesController < Api::V1::Accounts::Conversations::BaseController
  def create
    @message = @conversation.messages.build(
      content: permitted_params[:content],
      account_id: @conversation.account_id,
      inbox_id: @conversation.inbox_id,
      message_type: :incoming,
      sender: @conversation.contact,
      content_attributes: parsed_content_attributes,
      source_id: permitted_params[:source_id].presence
    )
    attach_files
    @message.save!
    render json: { id: @message.id }, status: :created
  rescue StandardError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def permitted_params
    params.permit(:content, :content_attributes, :source_id, attachments: [])
  end

  def parsed_content_attributes
    raw = params[:content_attributes]
    return {} if raw.blank?

    parsed = raw.is_a?(String) ? JSON.parse(raw) : raw.to_unsafe_h
    parsed.is_a?(Hash) ? parsed : {}
  rescue JSON::ParserError
    {}
  end

  def attach_files
    Array(params[:attachments]).each do |file|
      @message.attachments.new(
        account_id: @message.account_id,
        file_type: attachment_file_type(file.content_type),
        file: {
          io: file.tempfile,
          filename: file.original_filename,
          content_type: file.content_type
        }
      )
    end
  end

  def attachment_file_type(content_type)
    case content_type
    when %r{^audio/} then :audio
    when %r{^image/} then :image
    when %r{^video/} then :video
    else :file
    end
  end
end
