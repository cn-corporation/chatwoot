/* eslint-disable no-console, no-underscore-dangle, no-plusplus, no-restricted-syntax, no-eval */

class LeakDetector {
  constructor(config = {}) {
    this.pendingTimers = new Map();
    this.pendingIntervals = new Map();
    this.listeners = new Map();
    this.detachedElements = new WeakSet();
    this.elementListeners = new Map();
    this.mutationObserver = null;
    this.reportInterval = null;
    this.memoryHistory = [];
    this.initialMemory = null;

    // Configuration
    this.config = {
      reportIntervalMs: config.reportIntervalMs || 60000, // Report every 60 seconds
      trackDetachedElements: config.trackDetachedElements !== false,
      enableAutoReport: config.enableAutoReport !== false,
      detachedElementSampleSize: config.detachedElementSampleSize || 10,
      memoryHistoryLimit: config.memoryHistoryLimit || 20,
    };

    // Capture initial memory
    this.captureMemorySnapshot();
    this.initialMemory = LeakDetector.getMemoryStats();

    this.wrapTimerAPIs();
    this.wrapListenerAPIs();

    if (this.config.trackDetachedElements) {
      this.setupDetachedElementTracking();
    }

    if (this.config.enableAutoReport) {
      this.startAutoReport();
    }
  }

  wrapTimerAPIs() {
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    const originalSetInterval = window.setInterval;
    const originalClearInterval = window.clearInterval;
    const detector = this;

    window.setTimeout = (...args) => {
      const [callback, delay, ...rest] = args;
      let timerId;

      const wrappedCallback = (...cbArgs) => {
        detector.pendingTimers.delete(timerId);
        if (typeof callback === 'function') {
          return callback(...cbArgs);
        }
        return eval(callback);
      };

      timerId = originalSetTimeout(wrappedCallback, delay, ...rest);
      detector.pendingTimers.set(timerId, {
        stack: new Error().stack,
        createdAt: Date.now(),
      });
      return timerId;
    };

    window.clearTimeout = id => {
      detector.pendingTimers.delete(id);
      return originalClearTimeout(id);
    };

    window.setInterval = (...args) => {
      const id = originalSetInterval(...args);
      detector.pendingIntervals.set(id, {
        stack: new Error().stack,
        createdAt: Date.now(),
      });
      return id;
    };

    window.clearInterval = id => {
      detector.pendingIntervals.delete(id);
      return originalClearInterval(id);
    };
  }

  wrapListenerAPIs() {
    const original = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    const detector = this;

    EventTarget.prototype.addEventListener = function addListener(
      type,
      listener,
      options
    ) {
      // Safety check - only track if detector is initialized and this has a constructor
      if (detector && this && this.constructor) {
        const key = `${this.constructor.name}-${type}`;
        if (!detector.listeners.has(key)) {
          detector.listeners.set(key, []);
        }

        // Track listener on this specific element
        if (this instanceof Element) {
          if (!detector.elementListeners.has(this)) {
            detector.elementListeners.set(this, []);
          }
          detector.elementListeners.get(this).push({
            type,
            listener,
            stack: new Error().stack,
          });
        }

        detector.listeners.get(key).push({
          element: this,
          type,
          listener,
          stack: new Error().stack,
        });
      }

      return original.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function removeListener(
      type,
      listener,
      options
    ) {
      // Safety check
      if (detector && this && this.constructor) {
        const key = `${this.constructor.name}-${type}`;
        const list = detector.listeners.get(key) || [];
        const index = list.findIndex(
          l => l.listener === listener && l.element === this
        );
        if (index > -1) list.splice(index, 1);

        // Remove from element-specific tracking
        if (this instanceof Element) {
          const elementList = detector.elementListeners.get(this);
          if (elementList) {
            const elIndex = elementList.findIndex(
              l => l.listener === listener && l.type === type
            );
            if (elIndex > -1) elementList.splice(elIndex, 1);
          }
        }
      }

      return originalRemove.call(this, type, listener, options);
    };
  }

  setupDetachedElementTracking() {
    // Track all elements that get removed from the DOM
    this.mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
          mutation.removedNodes.forEach(node => {
            if (node instanceof Element) {
              this.trackDetachedElement(node);
            }
          });
        }
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  trackDetachedElement(element) {
    // Check if element is truly detached (not reattached elsewhere)
    setTimeout(() => {
      if (!document.body.contains(element)) {
        this.detachedElements.add(element);
      }
    }, 100); // Small delay to allow for re-attachment
  }

  getDetachedElementsWithListeners() {
    const detached = [];
    const entries = Array.from(this.elementListeners.entries());

    entries.forEach(([element, listeners]) => {
      // Check if element is detached
      if (!document.body.contains(element) && listeners.length > 0) {
        detached.push({
          element,
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          listeners: listeners.map(l => ({
            type: l.type,
            stack: l.stack.split('\n')[2]?.trim() || 'unknown',
          })),
        });
      }
    });

    return detached;
  }

  getDetachedElementStats() {
    let detachedCount = 0;
    let detachedWithListeners = 0;
    let totalListenersOnDetached = 0;

    const entries = Array.from(this.elementListeners.entries());
    entries.forEach(([element, listeners]) => {
      if (!document.body.contains(element)) {
        detachedCount += 1;
        if (listeners.length > 0) {
          detachedWithListeners += 1;
          totalListenersOnDetached += listeners.length;
        }
      }
    });

    return {
      detachedCount,
      detachedWithListeners,
      totalListenersOnDetached,
    };
  }

  static getMemoryStats() {
    // Check if performance.memory is available (Chrome/Edge only)
    if (!performance.memory) {
      return null;
    }

    const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const totalMB = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(
      2
    );
    const limitMB = (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(
      2
    );
    const availableMB = (limitMB - usedMB).toFixed(2);
    const usagePercent = ((usedMB / limitMB) * 100).toFixed(1);

    return {
      usedMB: parseFloat(usedMB),
      totalMB: parseFloat(totalMB),
      limitMB: parseFloat(limitMB),
      availableMB: parseFloat(availableMB),
      usagePercent: parseFloat(usagePercent),
      timestamp: Date.now(),
    };
  }

  captureMemorySnapshot() {
    const stats = LeakDetector.getMemoryStats();
    if (stats) {
      this.memoryHistory.push(stats);
      // Keep only the last N snapshots
      if (this.memoryHistory.length > this.config.memoryHistoryLimit) {
        this.memoryHistory.shift();
      }
    }
  }

  getMemoryTrend() {
    if (this.memoryHistory.length < 2) {
      return null;
    }

    const first = this.memoryHistory[0];
    const last = this.memoryHistory[this.memoryHistory.length - 1];
    const growthMB = (last.usedMB - first.usedMB).toFixed(2);
    const growthPercent = (
      ((last.usedMB - first.usedMB) / first.usedMB) *
      100
    ).toFixed(1);
    const timeSpanSec = Math.round((last.timestamp - first.timestamp) / 1000);

    return {
      growthMB: parseFloat(growthMB),
      growthPercent: parseFloat(growthPercent),
      timeSpanSec,
      isGrowing: growthMB > 0,
    };
  }

  startAutoReport() {
    this.reportInterval = setInterval(() => {
      this.report();
    }, this.config.reportIntervalMs);

    console.log(
      `🔍 LeakDetector: Auto-reporting every ${this.config.reportIntervalMs / 1000}s`
    );
  }

  stopAutoReport() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }

  report() {
    // Capture current memory snapshot
    this.captureMemorySnapshot();

    console.group('🔍 Memory Leak Detection Report');
    console.log(`Timestamp: ${new Date().toLocaleTimeString()}`);

    // Memory Usage
    const memoryStats = LeakDetector.getMemoryStats();
    if (memoryStats) {
      console.group(
        `💾 Memory: ${memoryStats.usedMB} MB / ${memoryStats.limitMB} MB (${memoryStats.usagePercent}%)`
      );
      console.log(`Used: ${memoryStats.usedMB} MB`);
      console.log(`Available: ${memoryStats.availableMB} MB`);
      console.log(`Heap Limit: ${memoryStats.limitMB} MB`);
      console.log(`Usage: ${memoryStats.usagePercent}%`);

      // Show trend if available
      const trend = this.getMemoryTrend();
      if (trend) {
        const trendIcon = trend.isGrowing ? '📈' : '📉';
        const trendColor = trend.growthMB > 10 ? 'color: red' : 'color: green';
        console.log(
          `%c${trendIcon} Trend: ${trend.growthMB > 0 ? '+' : ''}${trend.growthMB} MB (${trend.growthPercent > 0 ? '+' : ''}${trend.growthPercent}%) over ${trend.timeSpanSec}s`,
          trendColor
        );

        if (trend.growthMB > 20) {
          console.warn(
            `⚠️  Significant memory growth detected! (+${trend.growthMB} MB)`
          );
        }
      }

      // Show initial memory if available
      if (this.initialMemory) {
        const totalGrowth = (
          memoryStats.usedMB - this.initialMemory.usedMB
        ).toFixed(2);
        console.log(
          `Total growth since start: ${totalGrowth > 0 ? '+' : ''}${totalGrowth} MB`
        );
      }

      // Warning if memory usage is high
      if (memoryStats.usagePercent > 80) {
        console.warn('⚠️  High memory usage detected!');
      }

      console.groupEnd();
    } else {
      console.log(
        '💾 Memory tracking unavailable (performance.memory not supported)'
      );
    }

    // Timers
    console.group(`⏱️  Active Timers: ${this.pendingTimers.size}`);
    if (this.pendingTimers.size > 0) {
      const timerData = Array.from(this.pendingTimers.entries())
        .map(([id, data]) => ({
          id,
          age: `${Math.round((Date.now() - data.createdAt) / 1000)}s`,
          stack: data.stack.split('\n')[2]?.trim() || 'unknown',
        }))
        .slice(0, 10); // Limit to first 10

      console.table(timerData);
      if (this.pendingTimers.size > 10) {
        console.log(`... and ${this.pendingTimers.size - 10} more`);
      }
    }
    console.groupEnd();

    // Intervals
    console.group(`🔄 Active Intervals: ${this.pendingIntervals.size}`);
    if (this.pendingIntervals.size > 0) {
      const intervalData = Array.from(this.pendingIntervals.entries())
        .map(([id, data]) => ({
          id,
          age: `${Math.round((Date.now() - data.createdAt) / 1000)}s`,
          stack: data.stack.split('\n')[2]?.trim() || 'unknown',
        }))
        .slice(0, 10);

      console.table(intervalData);
      if (this.pendingIntervals.size > 10) {
        console.log(`... and ${this.pendingIntervals.size - 10} more`);
      }
    }
    console.groupEnd();

    // Event Listeners
    console.group('🎧 Event Listeners by Type');
    const listenerWarnings = [];
    const listenerEntries = Array.from(this.listeners.entries());
    listenerEntries.forEach(([key, listeners]) => {
      if (listeners.length > 20) {
        listenerWarnings.push({
          type: key,
          count: listeners.length,
          sample:
            listeners[0]?.stack.split('\n').slice(1, 3).join('\n') || 'unknown',
        });
      }
    });

    if (listenerWarnings.length > 0) {
      console.warn('⚠️  High listener counts detected:');
      console.table(
        listenerWarnings.map(l => ({
          Type: l.type,
          Count: l.count,
        }))
      );
    } else {
      console.log('✅ No excessive listener counts detected');
    }
    console.groupEnd();

    // Detached Elements
    let stats = null;
    if (this.config.trackDetachedElements) {
      stats = this.getDetachedElementStats();
      console.group(`🗑️  Detached Elements: ${stats.detachedCount}`);

      if (stats.detachedWithListeners > 0) {
        console.warn(
          `⚠️  ${stats.detachedWithListeners} detached elements with ${stats.totalListenersOnDetached} active listeners`
        );

        const detachedWithListeners =
          this.getDetachedElementsWithListeners().slice(
            0,
            this.config.detachedElementSampleSize
          );

        detachedWithListeners.forEach((item, idx) => {
          const idStr = item.id ? `#${item.id}` : '';
          const classStr = item.className
            ? `.${item.className.split(' ').join('.')}`
            : '';
          console.group(
            `Element ${idx + 1}: <${item.tagName.toLowerCase()}${idStr}${classStr}>`
          );
          console.log(`Listeners: ${item.listeners.length}`);
          console.table(item.listeners);
          console.groupEnd();
        });

        if (
          stats.detachedWithListeners > this.config.detachedElementSampleSize
        ) {
          console.log(
            `... and ${stats.detachedWithListeners - this.config.detachedElementSampleSize} more detached elements with listeners`
          );
        }
      } else {
        console.log('✅ No detached elements with active listeners');
      }
      console.groupEnd();
    }

    // Summary
    const hasIssues =
      this.pendingTimers.size > 50 ||
      this.pendingIntervals.size > 10 ||
      listenerWarnings.length > 0 ||
      (stats && stats.detachedWithListeners > 0);

    if (hasIssues) {
      console.warn('⚠️  POTENTIAL MEMORY LEAKS DETECTED');
    } else {
      console.log('✅ No significant issues detected');
    }

    console.groupEnd();

    // Send to analytics if available
    if (typeof window.posthog !== 'undefined') {
      const analyticsStats = this.getDetachedElementStats();
      const analyticsMemory = LeakDetector.getMemoryStats();
      window.posthog.capture('leak_detection_report', {
        active_timers: this.pendingTimers.size,
        active_intervals: this.pendingIntervals.size,
        listener_types: Object.fromEntries(
          Array.from(this.listeners.entries()).map(([k, v]) => [k, v.length])
        ),
        detached_elements: analyticsStats.detachedCount,
        detached_with_listeners: analyticsStats.detachedWithListeners,
        total_listeners_on_detached: analyticsStats.totalListenersOnDetached,
        memory_used_mb: analyticsMemory?.usedMB,
        memory_available_mb: analyticsMemory?.availableMB,
        memory_usage_percent: analyticsMemory?.usagePercent,
      });
    }

    return {
      timers: this.pendingTimers.size,
      intervals: this.pendingIntervals.size,
      listeners: Array.from(this.listeners.entries()).reduce(
        (sum, [, v]) => sum + v.length,
        0
      ),
      detached: this.config.trackDetachedElements
        ? this.getDetachedElementStats()
        : null,
      memory: memoryStats,
      memoryTrend: this.getMemoryTrend(),
    };
  }

  static forceGarbageCollection() {
    // Only works in Chrome with --js-flags="--expose-gc"
    if (window.gc) {
      console.log('🗑️  Forcing garbage collection...');
      window.gc();
      console.log('✅ Garbage collection completed');
      // Wait a bit then show new memory stats
      setTimeout(() => {
        const stats = LeakDetector.getMemoryStats();
        if (stats) {
          console.log(`💾 Memory after GC: ${stats.usedMB} MB`);
        }
      }, 100);
    } else {
      console.warn(
        '⚠️  Garbage collection not available. Run Chrome with --js-flags="--expose-gc"'
      );
    }
  }

  cleanup() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.stopAutoReport();
  }
}

// Initialize global leak detector
if (typeof window !== 'undefined') {
  window.leakDetector = new LeakDetector({
    reportIntervalMs: 10000, // Report every 10 seconds
    trackDetachedElements: true,
    enableAutoReport: true,
    detachedElementSampleSize: 10,
    memoryHistoryLimit: 20,
  });

  // Add manual triggers for debugging
  window.checkLeaks = () => window.leakDetector.report();
  window.forceGC = () => LeakDetector.forceGarbageCollection();

  const initialMemory = LeakDetector.getMemoryStats();
  const memoryInfo = initialMemory
    ? ` Initial memory: ${initialMemory.usedMB} MB / ${initialMemory.limitMB} MB`
    : '';

  console.log(
    `🔍 LeakDetector initialized.${memoryInfo}\nCommands:\n  - window.checkLeaks() - trigger a report\n  - window.forceGC() - force garbage collection`
  );
}

export default LeakDetector;
