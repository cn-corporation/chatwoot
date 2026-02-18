/* global axios */

const CHATWOOT_EXTRA_API_URL = (
  window.chatwootConfig?.chatwootExtraApiUrl || 'http://localhost:3001'
).replace(/\/$/, ''); // Remove trailing slash if present
const CHATWOOT_EXTRA_API_KEY = window.chatwootConfig?.chatwootExtraApiKey || '';

// Custom params serializer for arrays
// Converts { operatorIds: ['id1', 'id2'] } to "operatorIds=id1&operatorIds=id2"
function serializeParams(params) {
  const parts = [];
  Object.keys(params).forEach(key => {
    const value = params[key];
    if (Array.isArray(value)) {
      value.forEach(item => {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
      });
    } else if (value !== null && value !== undefined) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  return parts.join('&');
}

class ResponseStatisticsAPI {
  constructor() {
    this.baseURL = CHATWOOT_EXTRA_API_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': CHATWOOT_EXTRA_API_KEY,
    };
  }

  async getStatistics(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getOperatorStatistics(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics/by-operator`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getDateRangeStatistics(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics/by-date-range`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getDistribution(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics/distribution`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getFirstResponseDistribution(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics/first-response-distribution`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }

  async getAgentsOverview(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/response-statistics/statistics/agents-overview`,
      {
        params,
        headers: this.headers,
      }
    );
    return response.data;
  }
}

export default new ResponseStatisticsAPI();
