export class WindowVisibilityHelper {
  constructor() {
    this.isVisible = true;
    this.onBlur = () => {
      this.isVisible = false;
    };
    this.onFocus = () => {
      this.isVisible = true;
    };
    this.initializeEvent();
  }

  initializeEvent = () => {
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
  };

  destroy = () => {
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
  };

  isWindowVisible() {
    return !document.hidden && this.isVisible;
  }
}

export default new WindowVisibilityHelper();
