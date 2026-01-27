/* global axios */

const CHATWOOT_EXTRA_API_URL = (
  window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001'
).replace(/\/$/, '');
const CHATWOOT_EXTRA_API_KEY = window.chatwootConfig?.chatwootExtraApiKey || '';

function serializeParams(params) {
  const parts = [];
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
      value.forEach(item => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
      });
    } else if (value !== null && value !== undefined && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  return parts.join('&');
}

class ResolutionStatisticsAPI {
  constructor() {
    this.baseURL = CHATWOOT_EXTRA_API_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': CHATWOOT_EXTRA_API_KEY,
    };
  }

  async getStatistics(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/resolution-statistics/statistics`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getAggregatedStatistics(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/resolution-statistics/statistics/aggregated`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getResolutionReasons() {
    const response = await axios.get(
      `${this.baseURL}/api/resolution-statistics/reasons`,
      {
        headers: this.headers,
      }
    );
    return response.data;
  }

  async getResolutionTopics() {
    const response = await axios.get(
      `${this.baseURL}/api/resolution-statistics/topics`,
      {
        headers: this.headers,
      }
    );
    return response.data;
  }
}

export default new ResolutionStatisticsAPI();
