/* global axios */
import ApiClient from './ApiClient';

class LinkedSourceChannelsAPI extends ApiClient {
  constructor() {
    super('conversations', { accountScoped: true });
  }

  get(conversationId) {
    return axios.get(`${this.url}/${conversationId}/linked_source_channels`);
  }
}

export default new LinkedSourceChannelsAPI();
