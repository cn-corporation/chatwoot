import Auth from '../api/auth';
import {
  clearCookiesOnLogout,
  deleteIndexedDBOnLogout,
} from '../store/utils/api';

const REQUEST_TIMEOUT_MS = 20000;
const CACHE_DURATION_MS = 3000;

let forcedLogoutInProgress = false;
const forceLogoutRedirect = () => {
  if (forcedLogoutInProgress) return;
  forcedLogoutInProgress = true;
  try {
    deleteIndexedDBOnLogout();
    clearCookiesOnLogout();
  } finally {
    window.location.replace('/app/login');
  }
};

const pendingRequests = new Map();
const responseCache = new Map();

const getRequestKey = config => {
  const { method = 'get', url = '', params, data } = config;
  return JSON.stringify({ method: method.toLowerCase(), url, params, data });
};

const parseErrorCode = error => Promise.reject(error);

export default axios => {
  const { apiHost = '' } = window.chatwootConfig || {};
  const wootApi = axios.create({ baseURL: `${apiHost}/` });

  if (Auth.hasAuthCookie()) {
    const {
      'access-token': accessToken,
      'token-type': tokenType,
      client,
      expiry,
      uid,
    } = Auth.getAuthData();
    Object.assign(wootApi.defaults.headers.common, {
      'access-token': accessToken,
      'token-type': tokenType,
      client,
      expiry,
      uid,
    });
  }

  wootApi.interceptors.request.use(config => {
    if (!config.signal) {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );
      config.signal = controller.signal;
      config.timeoutId = timeoutId;
    }
    return config;
  });

  wootApi.interceptors.response.use(
    response => {
      if (response.config.timeoutId) {
        clearTimeout(response.config.timeoutId);
      }

      const { requestKey } = response.config;
      if (requestKey) {
        responseCache.set(requestKey, {
          response,
          timestamp: Date.now(),
        });
        pendingRequests.delete(requestKey);
      }

      return response;
    },
    error => {
      if (error.config?.timeoutId) {
        clearTimeout(error.config.timeoutId);
      }

      const { requestKey } = error.config || {};
      if (requestKey) {
        pendingRequests.delete(requestKey);
      }

      const status = error.response?.status;
      const url = error.config?.url || '';
      const isAuthEndpoint =
        url.includes('/auth/sign_in') || url.includes('/auth/sign_out');
      if (status === 401 && !isAuthEndpoint && Auth.hasAuthCookie()) {
        forceLogoutRedirect();
      }

      return parseErrorCode(error);
    }
  );

  const wrapWithDedup = (method, url, dataOrConfig, config) => {
    const hasData = ['post', 'put', 'patch'].includes(method);
    const finalConfig = hasData
      ? { ...(config || {}), method, url, data: dataOrConfig }
      : { ...(dataOrConfig || {}), method, url };

    const requestKey = getRequestKey(finalConfig);

    const pending = pendingRequests.get(requestKey);
    if (pending) {
      return pending;
    }

    const cached = responseCache.get(requestKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return Promise.resolve(cached.response);
    }

    finalConfig.requestKey = requestKey;

    const promise = wootApi.request(finalConfig).finally(() => {
      pendingRequests.delete(requestKey);
    });

    pendingRequests.set(requestKey, promise);
    return promise;
  };

  const originalGet = wootApi.get.bind(wootApi);
  const originalPost = wootApi.post.bind(wootApi);
  const originalPut = wootApi.put.bind(wootApi);
  const originalPatch = wootApi.patch.bind(wootApi);
  const originalDelete = wootApi.delete.bind(wootApi);

  wootApi.get = (url, config) => wrapWithDedup('get', url, config);
  wootApi.delete = (url, config) => wrapWithDedup('delete', url, config);
  wootApi.post = (url, data, config) =>
    wrapWithDedup('post', url, data, config);
  wootApi.put = (url, data, config) => wrapWithDedup('put', url, data, config);
  wootApi.patch = (url, data, config) =>
    wrapWithDedup('patch', url, data, config);

  wootApi.originalGet = originalGet;
  wootApi.originalPost = originalPost;
  wootApi.originalPut = originalPut;
  wootApi.originalPatch = originalPatch;
  wootApi.originalDelete = originalDelete;

  return wootApi;
};
