import { frontendURL } from '../../../helper/URLHelper';
import store from '../../../store';

const TelegramDialoguesView = () => import('./TelegramDialoguesView.vue');

const TELEGRAM_PERMISSIONS = ['administrator', 'agent', 'custom_role'];

function canAccessTelegramDialogues() {
  const role = store.getters.getCurrentRole;
  if (role === 'administrator') return true;
  return store.getters['telegramDialoguesAccess/isCurrentUserAllowed'];
}

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/telegram-dialogues'),
      name: 'telegram_dialogues',
      meta: { permissions: TELEGRAM_PERMISSIONS },
      component: TelegramDialoguesView,
      beforeEnter: (_to, _from, next) => {
        if (canAccessTelegramDialogues()) {
          next();
        } else {
          next({ name: 'home' });
        }
      },
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
      beforeEnter: (_to, _from, next) => {
        if (canAccessTelegramDialogues()) {
          next();
        } else {
          next({ name: 'home' });
        }
      },
    },
  ],
};
