/* global axios */
import ApiClient from './ApiClient';

class MacrosAPI extends ApiClient {
  constructor() {
    super('macros', { accountScoped: true });
  }

  get(params = {}) {
    return axios.get(this.url, { params });
  }

  executeMacro({ macroId, conversationIds }) {
    return axios.post(`${this.url}/${macroId}/execute`, {
      conversation_ids: conversationIds,
    });
  }
}

export default new MacrosAPI();
