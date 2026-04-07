import { frontendURL } from '../../../helper/URLHelper';
import store from '../../../store';

const TelegramDialoguesView = () => import('./TelegramDialoguesView.vue');

const TELEGRAM_PERMISSIONS = ['administrator', 'agent', 'custom_role'];

function waitForUserReady() {
  if (!store.getters.getAuthUIFlags.isFetching) return Promise.resolve();
  return new Promise(resolve => {
    const unwatch = store.watch(
      () => store.getters.getAuthUIFlags.isFetching,
      isFetching => {
        if (!isFetching) {
          unwatch();
          resolve();
        }
      }
    );
  });
}

async function ensureTelegramAccessLoaded() {
  if (store.getters['telegramDialoguesAccess/isLoaded']) return;
  await store.dispatch('telegramDialoguesAccess/fetchOperators');
}

function canAccessTelegramDialogues(accountId) {
  const currentUser = store.getters.getCurrentUser;
  const { accounts = [] } = currentUser;
  const account = accounts.find(a => a.id === Number(accountId));
  if (account?.role === 'administrator') return true;
  return store.getters['telegramDialoguesAccess/isCurrentUserAllowed'];
}

const telegramBeforeEnter = async to => {
  await waitForUserReady();
  await ensureTelegramAccessLoaded();
  const { accountId } = to.params;
  if (canAccessTelegramDialogues(accountId)) return true;
  return { path: frontendURL(`accounts/${accountId}/dashboard`) };
};

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/telegram-dialogues'),
      name: 'telegram_dialogues',
      meta: { permissions: TELEGRAM_PERMISSIONS },
      component: TelegramDialoguesView,
      beforeEnter: telegramBeforeEnter,
    },
    {
      path: frontendURL(
        'accounts/:accountId/telegram-dialogues/:sourceId/chats/:chatId'
      ),
      name: 'telegram_dialogues_chat',
      meta: { permissions: TELEGRAM_PERMISSIONS },
      component: TelegramDialoguesView,
      props: route => ({
        sourceId: route.params.sourceId,
        chatId: Number(route.params.chatId),
      }),
      beforeEnter: telegramBeforeEnter,
    },
  ],
};
