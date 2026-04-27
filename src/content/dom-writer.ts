// Based on patch 4
export type WriteStrategy = "execCommand" | "inputEvent" | "pmDirect" | "pmHack";

interface RuleSnapshot {
  ruleCount: number;
  satisfiedRules: Set<number>;
  passwordContent: string;
}

export class DOMWriter {
  private editor: HTMLElement | null = null;
  private activeStrategy: WriteStrategy | null = null;

  async detectStrategy(): Promise<WriteStrategy> {
    const editor = this.findEditor();
    const strategies: { name: WriteStrategy; fn: (text: string) => void }[] = [
      { name: "execCommand", fn: (t) => this.writeViaExecCommand(t) },
      { name: "inputEvent", fn: (t) => this.writeViaInputEvent(t) },
      { name: "pmDirect", fn: (t) => this.writeViaProseMirrorView(t) },
      { name: "pmHack", fn: (t) => this.writeViaProseMirrorHack(t) },
    ];

    for (const strategy of strategies) {
      console.log(`[PWG] Testing strategy: ${strategy.name}`);
      const before = this.takeSnapshot();

      try {
        strategy.fn("PWG_TEST_123!");
      } catch (e) {
        console.log(`[PWG] Strategy ${strategy.name} threw: ${e}`);
        continue;
      }

      await this.waitForDOMStability(500);

      const after = this.takeSnapshot();

      if (this.snapshotsDiffer(before, after)) {
        console.log(`[PWG] ✓ Strategy '${strategy.name}' works (snapshot diff detected)`);
        this.activeStrategy = strategy.name;

        try { strategy.fn(""); } catch {}
        await this.waitForDOMStability(300);
        return strategy.name;
      }

      console.log(`[PWG] ✗ Strategy '${strategy.name}' — no snapshot change`);

      try { strategy.fn(before.passwordContent); } catch {}
      await this.waitForDOMStability(300);
    }

    throw new Error(
      "[PWG] FATAL: No write strategy produced a detectable state change. " +
      "See README troubleshooting section."
    );
  }

  typePassword(text: string): void {
    if (!this.activeStrategy) {
      throw new Error("[PWG] Call detectStrategy() before typePassword()");
    }

    switch (this.activeStrategy) {
      case "execCommand": this.writeViaExecCommand(text); break;
      case "inputEvent": this.writeViaInputEvent(text); break;
      case "pmDirect": this.writeViaProseMirrorView(text); break;
      case "pmHack": this.writeViaProseMirrorHack(text); break;
    }
  }

  private findEditor(): HTMLElement {
    if (this.editor) return this.editor;
    const el = document.querySelector<HTMLElement>("[contenteditable='true']");
    if (!el) throw new Error("Could not find ProseMirror editor element");
    this.editor = el;
    return el;
  }

  getCurrentEditorText(): string {
    try {
      const editor = this.findEditor();
      return editor.textContent || "";
    } catch {
      return "";
    }
  }

  private writeViaExecCommand(text: string): void {
    const editor = this.findEditor();
    editor.focus();
    document.execCommand("selectAll", false);
    if (text.includes("<b>") || text.includes("<strong>")) {
      document.execCommand("insertHTML", false, text);
    } else {
      document.execCommand("insertText", false, text);
    }
  }

  private writeViaInputEvent(text: string): void {
    const editor = this.findEditor();
    editor.focus();
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.dispatchEvent(new InputEvent("beforeinput", {
      inputType: "deleteContentBackward",
      bubbles: true, cancelable: true, composed: true,
    }));

    editor.dispatchEvent(new InputEvent("beforeinput", {
      inputType: "insertText",
      data: text,
      bubbles: true, cancelable: true, composed: true,
    }));
    editor.dispatchEvent(new InputEvent("input", {
      inputType: "insertText",
      data: text,
      bubbles: true,
    }));
  }

  private writeViaProseMirrorView(text: string): void {
    const view = this.findPMView();
    if (!view) throw new Error("ProseMirror view not found");

    const { state } = view;
    const tr = state.tr;
    tr.replaceWith(0, state.doc.content.size, state.schema.text(text));
    view.dispatch(tr);
  }

  private writeViaProseMirrorHack(text: string): void {
    const editor = this.findEditor();
    const viewPaths = [
      (editor as any).pmViewDesc?.view,
      (editor as any).__view,
      (editor as any)._view,
      (editor.parentElement as any)?.pmViewDesc?.view,
      (editor.parentElement as any)?.__view,
    ];

    const candidates = [...viewPaths];
    for (const key of Object.getOwnPropertyNames(editor)) {
      const val = (editor as any)[key];
      if (val && typeof val === "object" && val.state && val.dispatch && val.state.doc) {
        candidates.push(val);
      }
    }

    const view = candidates.find(v => v && v.state && v.dispatch);
    if (!view) throw new Error("Could not find ProseMirror view via hack");

    const { state } = view;
    const tr = state.tr;
    tr.replaceWith(0, state.doc.content.size, state.schema.text(text));
    view.dispatch(tr);
  }

  private findPMView(): any {
    const editor = this.findEditor();
    return (editor as any).pmViewDesc?.view || (editor as any).__view;
  }

  private waitForDOMStability(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private takeSnapshot(): RuleSnapshot {
    const rules = document.querySelectorAll("[class*='rule']");
    const satisfied = new Set<number>();
    let idx = 0;

    for (const rule of rules) {
      if (this.isRuleSatisfied(rule)) {
        satisfied.add(idx);
      }
      idx++;
    }

    const editor = this.findEditor();
    return {
      ruleCount: rules.length,
      satisfiedRules: satisfied,
      passwordContent: editor.textContent || "",
    };
  }

  private snapshotsDiffer(before: RuleSnapshot, after: RuleSnapshot): boolean {
    if (before.passwordContent === after.passwordContent) return false;
    if (before.satisfiedRules.size !== after.satisfiedRules.size) return true;

    for (const idx of after.satisfiedRules) {
      if (!before.satisfiedRules.has(idx)) return true;
    }
    for (const idx of before.satisfiedRules) {
      if (!after.satisfiedRules.has(idx)) return true;
    }

    if (before.ruleCount !== after.ruleCount) return true;

    return false;
  }

  private isRuleSatisfied(ruleEl: Element): boolean {
    return (
      ruleEl.classList.contains("satisfied") ||
      ruleEl.classList.contains("completed") ||
      ruleEl.querySelector("[class*='check'], [class*='satisfied']") !== null
    );
  }
}
