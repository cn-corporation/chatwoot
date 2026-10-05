json.meta do
  json.labels @conversation.cached_label_list_array
  json.additional_attributes @conversation.additional_attributes
  json.contact @conversation.contact.push_event_data
  json.assignee @conversation.assignee.push_event_data if @conversation.assignee.present?
  json.agent_last_seen_at @conversation.agent_last_seen_at
  json.assignee_last_seen_at @conversation.assignee_last_seen_at
  json.resolution_timestamps @resolution_timestamps if @resolution_timestamps
end

json.payload do
  json.array! @messages do |message|
    json.partial! 'api/v1/models/message', message: message
    json.workflow_epoch message.workflow_epoch if params[:include_resolution_history] == 'true'
  end
end
