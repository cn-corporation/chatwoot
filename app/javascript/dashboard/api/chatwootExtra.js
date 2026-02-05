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

  async createAutomation({ chatwootAutomationId, sourceChannelIds }) {
    const response = await axios.post(
      `${this.baseURL}/api/automations`,
      {
        chatwootAutomationId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async getAutomation(chatwootAutomationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/automations/${chatwootAutomationId}`,
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getAllAutomations() {
    try {
      const response = await axios.get(`${this.baseURL}/api/automations`, {
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async updateAutomationSources({ chatwootAutomationId, sourceChannelIds }) {
    const response = await axios.patch(
      `${this.baseURL}/api/automations/sources`,
      {
        chatwootAutomationId,
        sourceChannelIds,
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async deleteAutomation(chatwootAutomationId) {
    const response = await axios.delete(
      `${this.baseURL}/api/automations/${chatwootAutomationId}`,
      { headers: this.headers }
    );
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

  // Operator Notifications API
  async getOperatorNotifications(operatorId) {
    const response = await axios.get(
      `${this.baseURL}/api/operator-notifications/operator/${operatorId}`,
      { headers: this.headers }
    );
    return response.data;
  }

  getOperatorNotificationStreamURL(operatorId) {
    const apiKey = encodeURIComponent(CHATWOOT_EXTRA_API_KEY);
    return `${this.baseURL}/api/operator-notifications/stream/${operatorId}?apiKey=${apiKey}`;
  }

  async markConversationAsRead(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-notifications/mark-read`,
      {
        conversationId: String(conversationId),
        operatorId: String(operatorId),
      },
      { headers: this.headers }
    );
    return response.data;
  }

  async markConversationAsUnread(conversationId, operatorId) {
    const response = await axios.post(
      `${this.baseURL}/api/operator-notifications/mark-unread`,
      {
        conversationId: String(conversationId),
        operatorId: String(operatorId),
      },
      { headers: this.headers }
    );
    return response.data;
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

  async createPersonalCannedResponse({ chatwootUserId, command, text }) {
    const response = await axios.post(
      `${this.baseURL}/api/canned-responses`,
      { chatwootUserId, command, text },
      { headers: this.headers }
    );
    return response.data;
  }

  async getPersonalCannedResponses(chatwootUserId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/canned-responses/user/${chatwootUserId}`,
        { headers: this.headers }
      );
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async updatePersonalCannedResponse(id, { command, text }) {
    const response = await axios.patch(
      `${this.baseURL}/api/canned-responses/${id}`,
      { command, text },
      { headers: this.headers }
    );
    return response.data;
  }

  async deletePersonalCannedResponse(id) {
    const response = await axios.delete(
      `${this.baseURL}/api/canned-responses/${id}`,
      { headers: this.headers }
    );
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

  async getAdLogsByUser(tgid, chatwootChannelId = null) {
    const params = { tgid };
    if (chatwootChannelId) {
      params.chatwootChannelId = chatwootChannelId;
    }
    const response = await axios.get(`${this.baseURL}/api/ads-log/by-user`, {
      params,
      headers: this.headers,
    });
    return response.data;
  }

  async getAdErrorLogs(adId) {
    const response = await axios.get(`${this.baseURL}/api/ads-log/errors`, {
      params: { adId },
      headers: this.headers,
    });
    return response.data;
  }

  // Tasks API
  async createTask(data) {
    const response = await axios.post(`${this.baseURL}/api/tasks`, data, {
      headers: this.headers,
    });
    return response.data;
  }

  async updateTask(taskId, data) {
    const response = await axios.patch(
      `${this.baseURL}/api/tasks/${taskId}`,
      data,
      { headers: this.headers }
    );
    return response.data;
  }

  async getTask(taskId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks/${taskId}`, {
        headers: this.headers,
      });
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async getTasks(conversationId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks`, {
        params: { conversationId },
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async getTasksReport(filters = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/api/tasks/report`, {
        params: filters,
        headers: this.headers,
      });
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  }

  async searchMessages({
    query,
    userId,
    dateFrom,
    dateTo,
    accountId,
    limit = 20,
    offset = 0,
  }) {
    const params = { query, accountId, limit, offset };
    if (userId) params.userId = userId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const response = await axios.get(`${this.baseURL}/api/message-search`, {
      params,
      headers: this.headers,
    });
    return response.data;
  }
}

export default new ChatwootExtraAPI();
