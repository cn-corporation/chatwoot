<script>
import { useVuelidate } from '@vuelidate/core';
import { required, minLength } from '@vuelidate/validators';
import { useAlert } from 'dashboard/composables';

import NextButton from 'dashboard/components-next/button/Button.vue';
import Modal from '../../../../components/Modal.vue';
import WootMessageEditor from 'dashboard/components/widgets/WootWriter/Editor.vue';

export default {
  name: 'AddPersonalCanned',
  components: {
    NextButton,
    Modal,
    WootMessageEditor,
  },
  props: {
    responseContent: {
      type: String,
      default: '',
    },
    onClose: {
      type: Function,
      default: () => {},
    },
  },
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      command: '',
      text: this.responseContent || '',
      addCanned: {
        showLoading: false,
        message: '',
      },
      show: true,
    };
  },
  validations: {
    command: {
      required,
      minLength: minLength(2),
    },
    text: {
      required,
    },
  },
  methods: {
    resetForm() {
      this.command = '';
      this.text = '';
      this.v$.command.$reset();
      this.v$.text.$reset();
    },
    addPersonalCannedResponse() {
      this.addCanned.showLoading = true;
      this.$store
        .dispatch('personalCannedResponse/createPersonalCannedResponse', {
          command: this.command,
          text: this.text,
        })
        .then(() => {
          this.addCanned.showLoading = false;
          useAlert(this.$t('PERSONAL_CANNED_MGMT.ADD.API.SUCCESS_MESSAGE'));
          this.resetForm();
          this.onClose();
        })
        .catch(error => {
          this.addCanned.showLoading = false;
          const errorMessage =
            error?.message ||
            this.$t('PERSONAL_CANNED_MGMT.ADD.API.ERROR_MESSAGE');
          useAlert(errorMessage);
        });
    },
  },
};
</script>

<template>
  <Modal v-model:show="show" :on-close="onClose">
    <div class="flex flex-col h-auto overflow-auto">
      <woot-modal-header
        :header-title="$t('PERSONAL_CANNED_MGMT.ADD.TITLE')"
        :header-content="$t('PERSONAL_CANNED_MGMT.ADD.DESC')"
      />
      <form
        class="flex flex-col w-full"
        @submit.prevent="addPersonalCannedResponse()"
      >
        <div class="w-full">
          <label :class="{ error: v$.command.$error }">
            {{ $t('PERSONAL_CANNED_MGMT.ADD.FORM.SHORT_CODE.LABEL') }}
            <input
              v-model="command"
              type="text"
              :placeholder="
                $t('PERSONAL_CANNED_MGMT.ADD.FORM.SHORT_CODE.PLACEHOLDER')
              "
              @blur="v$.command.$touch"
            />
          </label>
        </div>

        <div class="w-full">
          <label :class="{ error: v$.text.$error }">
            {{ $t('PERSONAL_CANNED_MGMT.ADD.FORM.CONTENT.LABEL') }}
          </label>
          <div class="editor-wrap">
            <WootMessageEditor
              v-model="text"
              class="message-editor [&>div]:px-1"
              :class="{ editor_warning: v$.text.$error }"
              enable-variables
              :enable-canned-responses="false"
              :placeholder="
                $t('PERSONAL_CANNED_MGMT.ADD.FORM.CONTENT.PLACEHOLDER')
              "
              @blur="v$.text.$touch"
            />
          </div>
        </div>
        <div class="flex flex-row justify-end w-full gap-2 px-0 py-2">
          <NextButton
            faded
            slate
            type="reset"
            :label="$t('PERSONAL_CANNED_MGMT.ADD.CANCEL_BUTTON_TEXT')"
            @click.prevent="onClose"
          />
          <NextButton
            type="submit"
            :label="$t('PERSONAL_CANNED_MGMT.ADD.FORM.SUBMIT')"
            :disabled="
              v$.text.$invalid || v$.command.$invalid || addCanned.showLoading
            "
            :is-loading="addCanned.showLoading"
          />
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped lang="scss">
::v-deep {
  .ProseMirror-menubar {
    @apply hidden;
  }

  .ProseMirror-woot-style {
    @apply min-h-[12.5rem];

    p {
      @apply text-base;
    }
  }
}
</style>
