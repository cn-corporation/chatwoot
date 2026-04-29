<script setup>
import { computed, h } from 'vue';
import { useMapGetter, useStore } from 'dashboard/composables/store';
import wootConstants from 'dashboard/constants/globals';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { useImpersonation } from 'dashboard/composables/useImpersonation';

import {
  DropdownContainer,
  DropdownBody,
  DropdownSection,
  DropdownItem,
} from 'next/dropdown-menu/base';
import Icon from 'next/icon/Icon.vue';
import Button from 'next/button/Button.vue';
import ToggleSwitch from 'dashboard/components-next/switch/Switch.vue';
import { useOperatorBreak } from 'dashboard/composables/useOperatorBreak';

const { t } = useI18n();
const store = useStore();
const currentUserAvailability = useMapGetter('getCurrentUserAvailability');
const currentAccountId = useMapGetter('getCurrentAccountId');
const currentUserAutoOffline = useMapGetter('getCurrentUserAutoOffline');

const { isImpersonating } = useImpersonation();

const { AVAILABILITY_STATUS_KEYS } = wootConstants;
const statusList = computed(() => {
  return [
    t('PROFILE_SETTINGS.FORM.AVAILABILITY.STATUS.ONLINE'),
    t('PROFILE_SETTINGS.FORM.AVAILABILITY.STATUS.BUSY'),
    t('PROFILE_SETTINGS.FORM.AVAILABILITY.STATUS.OFFLINE'),
  ];
});

const statusColors = ['bg-n-teal-9', 'bg-n-amber-9', 'bg-n-slate-9'];

const availabilityStatuses = computed(() => {
  return statusList.value.map((statusLabel, index) => ({
    label: statusLabel,
    value: AVAILABILITY_STATUS_KEYS[index],
    color: statusColors[index],
    icon: h('span', { class: [statusColors[index], 'size-[12px] rounded'] }),
    active: currentUserAvailability.value === AVAILABILITY_STATUS_KEYS[index],
  }));
});

const activeStatus = computed(() => {
  return availabilityStatuses.value.find(status => status.active);
});

const autoOfflineToggle = computed({
  get: () => currentUserAutoOffline.value,
  set: autoOffline => {
    store.dispatch('updateAutoOffline', {
      accountId: currentAccountId.value,
      autoOffline,
    });
  },
});

const { startBreak, isLoading: isBreakLoading } = useOperatorBreak();

const breakOptions = computed(() => [
  {
    value: 'smoke',
    label: t('BREAKS.SMOKE'),
    icon: 'i-lucide-cigarette',
  },
  {
    value: 'lunch',
    label: t('BREAKS.LUNCH'),
    icon: 'i-lucide-utensils',
  },
]);

async function takeBreak(breakType) {
  if (isImpersonating.value) {
    useAlert(t('PROFILE_SETTINGS.FORM.AVAILABILITY.IMPERSONATING_ERROR'));
    return;
  }
  try {
    await startBreak(breakType);
  } catch (error) {
    useAlert(t('BREAKS.START_ERROR'));
  }
}

function changeAvailabilityStatus(availability) {
  if (isImpersonating.value) {
    useAlert(t('PROFILE_SETTINGS.FORM.AVAILABILITY.IMPERSONATING_ERROR'));
    return;
  }
  try {
    store.dispatch('updateAvailability', {
      availability,
      account_id: currentAccountId.value,
    });
  } catch (error) {
    useAlert(t('PROFILE_SETTINGS.FORM.AVAILABILITY.SET_AVAILABILITY_ERROR'));
  }
}
</script>

<template>
  <DropdownSection class="[&>ul]:overflow-visible">
    <div class="grid gap-0">
      <DropdownItem preserve-open>
        <div class="flex-grow flex items-center gap-1">
          {{ $t('SIDEBAR.SET_YOUR_AVAILABILITY') }}
        </div>
        <DropdownContainer>
          <template #trigger="{ toggle }">
            <Button
              size="sm"
              color="slate"
              variant="faded"
              class="min-w-[96px]"
              icon="i-lucide-chevron-down"
              trailing-icon
              @click="toggle"
            >
              <div class="flex gap-1 items-center flex-grow text-sm">
                <div class="p-1 flex-shrink-0">
                  <div class="size-2 rounded-sm" :class="activeStatus.color" />
                </div>
                <span>{{ activeStatus.label }}</span>
              </div>
            </Button>
          </template>
          <DropdownBody class="min-w-32 z-20">
            <DropdownItem
              v-for="status in availabilityStatuses"
              :key="status.value"
              :label="status.label"
              :icon="status.icon"
              class="cursor-pointer"
              @click="changeAvailabilityStatus(status.value)"
            />
          </DropdownBody>
        </DropdownContainer>
      </DropdownItem>
      <DropdownItem>
        <div class="flex-grow flex items-center gap-1">
          {{ $t('SIDEBAR.SET_AUTO_OFFLINE.TEXT') }}
          <Icon
            v-tooltip.top="$t('SIDEBAR.SET_AUTO_OFFLINE.INFO_SHORT')"
            icon="i-lucide-info"
            class="size-4 text-n-slate-10"
          />
        </div>
        <ToggleSwitch v-model="autoOfflineToggle" />
      </DropdownItem>
      <DropdownItem preserve-open>
        <div class="flex-grow flex items-center gap-1">
          {{ $t('BREAKS.MENU_LABEL') }}
        </div>
        <DropdownContainer>
          <template #trigger="{ toggle }">
            <Button
              size="sm"
              color="slate"
              variant="faded"
              class="min-w-[96px]"
              icon="i-lucide-chevron-down"
              trailing-icon
              :is-loading="isBreakLoading"
              :disabled="isBreakLoading"
              @click="toggle"
            >
              <div class="flex gap-1 items-center flex-grow text-sm">
                <span class="i-lucide-coffee size-4 flex-shrink-0" />
                <span>{{ $t('BREAKS.TAKE') }}</span>
              </div>
            </Button>
          </template>
          <DropdownBody class="min-w-32 z-20">
            <DropdownItem
              v-for="option in breakOptions"
              :key="option.value"
              :label="option.label"
              :icon="option.icon"
              class="cursor-pointer"
              @click="takeBreak(option.value)"
            />
          </DropdownBody>
        </DropdownContainer>
      </DropdownItem>
    </div>
  </DropdownSection>
</template>
