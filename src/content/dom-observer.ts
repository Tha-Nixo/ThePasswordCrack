export class DOMObserver {
  private ruleObserver: MutationObserver | null = null;
  private pollTimer: number | null = null;
  private lastKnownState: string = "";

  onRulesChanged(callback: () => void): void {
    const debouncedCallback = this.debounce(callback, 150);

    const ruleContainer = this.findRuleContainer();
    if (ruleContainer) {
      this.ruleObserver = new MutationObserver(() => debouncedCallback());
      this.ruleObserver.observe(ruleContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    const bodyObserver = new MutationObserver((mutations) => {
      const structural = mutations.some(m =>
        m.type === "childList" && m.addedNodes.length > 0
      );
      if (structural) debouncedCallback();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });

    this.pollTimer = window.setInterval(() => {
      const currentState = this.computeStateHash();
      if (currentState !== this.lastKnownState) {
        this.lastKnownState = currentState;
        debouncedCallback();
      }
    }, 3000);
  }

  private computeStateHash(): string {
    const rules = document.querySelectorAll("[class*='rule']");
    const parts: string[] = [];
    for (const rule of rules) {
      parts.push(`${rule.textContent?.slice(0, 50)}|${rule.className}`);
    }
    return `${rules.length}:${parts.join("||")}`;
  }

  async waitForStability(quietMs = 200, timeoutMs = 3000): Promise<void> {
    return new Promise((resolve) => {
      let timer: number | null = null;
      let timeout: number | null = null;
      let lastHash = this.computeStateHash();
      let obs: MutationObserver | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (timeout) clearTimeout(timeout);
        if (obs) obs.disconnect();
      };

      const checkStable = () => {
        const currentHash = this.computeStateHash();
        if (currentHash === lastHash) {
          cleanup();
          resolve();
        } else {
          lastHash = currentHash;
          if (timer) clearTimeout(timer);
          timer = window.setTimeout(checkStable, quietMs);
        }
      };

      timeout = window.setTimeout(() => { cleanup(); resolve(); }, timeoutMs);

      obs = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = window.setTimeout(checkStable, quietMs);
      });

      const target = this.findRuleContainer() || document.body;
      obs.observe(target, {
        childList: true, subtree: true,
        attributes: true, characterData: true,
      });

      timer = window.setTimeout(checkStable, quietMs);
    });
  }

  private debounce(fn: () => void, ms: number): () => void {
    let timer: number = 0;
    return () => {
      clearTimeout(timer);
      timer = window.setTimeout(fn, ms);
    };
  }

  private findRuleContainer(): HTMLElement | null {
    return document.querySelector<HTMLElement>("[class*='rules'], [class*='rule-list']");
  }

  destroy(): void {
    this.ruleObserver?.disconnect();
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}
