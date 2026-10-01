/* global axios */
import ApiClient from './ApiClient';

class RetentionAPI extends ApiClient {
  constructor() {
    super('retention/members', { accountScoped: true });
  }

  updateMembers({ userIds, revision }) {
    return axios.put(this.url, { user_ids: userIds, revision });
  }

  get workspaceUrl() {
    return `${this.baseUrl()}/retention`;
  }

  capabilities() {
    return axios.get(`${this.workspaceUrl}/capabilities`);
  }

  conversations(params) {
    return axios.get(`${this.workspaceUrl}/conversations`, { params });
  }

  conversation(id, params) {
    return axios.get(`${this.workspaceUrl}/conversations/${id}`, { params });
  }

  read(id, { sessionId, lastMessageId }) {
    return axios.post(`${this.workspaceUrl}/conversations/${id}/read`, {
      session_id: sessionId,
      last_message_id: lastMessageId,
    });
  }

  send(id, data) {
    let body = data;
    if (data.attachments?.length) {
      body = new FormData();
      body.append('content', data.content || '');
      body.append('request_id', data.request_id);
      if (data.session_id) body.append('session_id', data.session_id);
      data.attachments.forEach(file => body.append('attachments[]', file));
    }
    return axios.post(
      `${this.workspaceUrl}/conversations/${id}/messages`,
      body
    );
  }

  complete(id, sessionId) {
    return axios.post(`${this.workspaceUrl}/conversations/${id}/complete`, {
      session_id: sessionId,
    });
  }

  retry(id, messageId) {
    return axios.post(
      `${this.workspaceUrl}/conversations/${id}/messages/${messageId}/retry`
    );
  }

  editMessage(id, messageId, { sessionId, content, expectedContent }) {
    return axios.patch(
      `${this.workspaceUrl}/conversations/${id}/messages/${messageId}`,
      {
        session_id: sessionId,
        content,
        expected_content: expectedContent,
      }
    );
  }

  deleteMessage(id, messageId, { sessionId, expectedContent }) {
    return axios.delete(
      `${this.workspaceUrl}/conversations/${id}/messages/${messageId}`,
      {
        data: { session_id: sessionId, expected_content: expectedContent },
      }
    );
  }

  history(params) {
    return axios.get(`${this.workspaceUrl}/history`, { params });
  }

  snapshot(id) {
    return axios.get(`${this.workspaceUrl}/snapshots/${id}`);
  }
}

export default new RetentionAPI();
