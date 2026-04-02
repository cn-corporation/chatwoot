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

class QualityReviewStatisticsAPI {
  constructor() {
    this.baseURL = CHATWOOT_EXTRA_API_URL;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': CHATWOOT_EXTRA_API_KEY,
    };
  }

  async getAggregatedReport(params = {}) {
    const response = await axios.get(
      `${this.baseURL}/api/quality-review-report/aggregated`,
      {
        params,
        headers: this.headers,
        paramsSerializer: serializeParams,
      }
    );
    return response.data;
  }
}

export default new QualityReviewStatisticsAPI();
