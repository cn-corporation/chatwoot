import { frontendURL } from '../../../helper/URLHelper';

const TelegramDialoguesView = () => import('./TelegramDialoguesView.vue');

const TELEGRAM_PERMISSIONS = ['administrator', 'agent', 'custom_role'];

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/telegram-dialogues'),
      name: 'telegram_dialogues',
      meta: { permissions: TELEGRAM_PERMISSIONS },
      component: TelegramDialoguesView,
    },
    {
      path: frontendURL('accounts/:accountId/telegram-dialogues/:sourceId/chats/:chatId'),
      name: 'telegram_dialogues_chat',
      meta: { permissions: TELEGRAM_PERMISSIONS },
      component: TelegramDialoguesView,
      props: route => ({
        sourceId: route.params.sourceId,
        chatId: Number(route.params.chatId),
      }),
    },
  ],
};
