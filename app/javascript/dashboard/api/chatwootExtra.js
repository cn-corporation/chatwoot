/* global axios */

const CHATWOOT_EXTRA_API_URL = (
  window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001'
).replace(/\/$/, ''); // Remove trailing slash if present
const CHATWOOT_EXTRA_API_KEY = window.chatwootConfig?.chatwootExtraApiKey || '';

class ChatwootExtraAPI {
  constructor() {
    this.baseURL = CHATWOOT_EXTRA_API_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': CHATWOOT_EXTRA_API_KEY,
    };
  }

  async createMacro({ chatwootUserId, chatwootMacrosId, sourceChannelIds }) {
    const response = await axios.post(
      `${this.baseURL}/api/macros`,
      {
        chatwootUserId,
        chatwootMacrosId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    // Backend returns { success: true, data: {...} }
    return response.data;
  }

  async getMacro(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/macros/${id}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getMacrosByUser(chatwootUserId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/macros/user/${chatwootUserId}`,
        { headers: this.headers }
      );
      // Backend returns { success: true, data: [...] }
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getAllMacros() {
    try {
      const response = await axios.get(`${this.baseURL}/api/macros`, {
        headers: this.headers,
      });
      // Backend returns { success: true, data: [...] }
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getMacrosByUserAndChannel(chatwootUserId, chatwootChannelId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/macros/user/${chatwootUserId}/channel/${chatwootChannelId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async updateMacroSources({
    chatwootUserId,
    chatwootMacrosId,
    sourceChannelIds,
  }) {
    const response = await axios.patch(
      `${this.baseURL}/api/macros/sources`,
      {
        chatwootUserId,
        chatwootMacrosId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    // Backend returns { success: true, data: {...} }
    return response.data;
  }

  async deleteMacro(id) {
    const response = await axios.delete(`${this.baseURL}/api/macros/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  async getSourceChannel(chatwootChannelId) {
    const response = await axios.get(
      `${this.baseURL}/api/source-channels/${chatwootChannelId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async updateSourceChannel(chatwootChannelId, data) {
    const response = await axios.patch(
      `${this.baseURL}/api/source-channels/${chatwootChannelId}`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async getAISuggestion(conversationId) {
    const response = await axios.get(
      `${this.baseURL}/api/ai-suggestions/${conversationId}`,
      { headers: this.headers }
    );
    return response.data?.data || null;
  }

  // Operator Presence API
  async getPresenceState(conversationId) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async joinConversation(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/join`,
      { operatorId },
      { headers: this.headers }
    );
    return response.data;
  }

  async leaveConversation(conversationId, operatorId) {
    const response = await axios.delete(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/leave`,
      {
        data: { operatorId },
        headers: this.headers,
      }
    );
    return response.data;
  }

  async sendHeartbeat(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-presence/conversations/${conversationId}/heartbeat`,
      { operatorId },
      { headers: this.headers }
    );
    return response.data;
  }

  getOperatorPresenceStreamURL(conversationId, operatorId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/operator-presence/conversations/${conversationId}/stream?operatorId=${operatorId}&apiKey=${apiKey}`;
  }

  // Ads API
  async createAd(data) {
    const response = await axios.post(`${this.baseURL}/api/ads`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async getAllAds() {
    try {
      const response = await axios.get(`${this.baseURL}/api/ads`, {
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getAd(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/ads/${id}`, {
        headers: this.headers,
      });
      return response.data?.data || null;
    } catch (error) {
      return null;
    }
  }

  async updateAd(id, data) {
    const response = await axios.patch(`${this.baseURL}/api/ads/${id}`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async deleteAd(id) {
    const response = await axios.delete(`${this.baseURL}/api/ads/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  // Media API
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${this.baseURL}/api/media`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-API-Key': CHATWOOT_EXTRA_API_KEY,
      },
    });
    return response.data;
  }

  async getMedia(id) {
    try {
      const response = await axios.get(`${this.baseURL}/api/media/${id}`, {
        headers: this.headers,
      });
      return response.data?.data || null;
    } catch (error) {
      return null;
    }
  }

  async deleteMedia(id) {
    const response = await axios.delete(`${this.baseURL}/api/media/${id}`, {
      headers: this.headers,
    });
    return response.data;
  }

  // Ads Send Operations API
  async startAdSend(adId, bearerTokenHash, chatwootApiUrl) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/start`,
      { adId, bearerTokenHash, chatwootApiUrl },
      { headers: this.headers }
    );
    return response.data;
  }

  async testAdSend(adId, telegramId) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/test`,
      { adId, telegramId },
      { headers: this.headers }
    );
    return response.data;
  }

  async stopAdSend(sendOpId) {
    const response = await axios.post(
      `${this.baseURL}/api/ads-send-operations/${sendOpId}/stop`,
      {},
      { headers: this.headers }
    );
    return response.data;
  }

  async getAdSendStatus(sendOpId) {
    const response = await axios.get(
      `${this.baseURL}/api/ads-send-operations/${sendOpId}/status`,
      { headers: this.headers }
    );
    return response.data;
  }

  async getAdSendOperations(adId) {
    const response = await axios.get(
      `${this.baseURL}/api/ads-send-operations/ad/${adId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  // Ads Log API
  async deleteSentAds(adId) {
    const response = await axios.delete(
      `${this.baseURL}/api/ads-log/sent-ads`,
      {
        data: { adId },
        headers: this.headers,
      }
    );
    return response.data;
  }
}

export default new ChatwootExtraAPI();
