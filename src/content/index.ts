import { DOMReader } from "./dom-reader";
import { DOMWriter } from "./dom-writer";
import { DOMObserver } from "./dom-observer";
import { PasswordEngine } from "./password-engine";
import { BudgetTracker } from "./solver/budget";
import { RuleClassifier } from "./rule-classifier";
import { ConflictResolver } from "./conflict-resolver";
import { MainLoop } from "./main-loop";

import { HumanHandler } from "./handlers/human";
import { TextHandler } from "./handlers/text";
import { NumericSolver, NumericHandler } from "./handlers/numeric";
import { PatternHandler } from "./handlers/pattern";
import { TimeHandler } from "./handlers/time";
import { ExternalHandler } from "./handlers/external";
import { Handler } from "../shared/types";

function injectInterceptor() {
  if ((window as any).__pwgInterceptorInjected) return;
  (window as any).__pwgInterceptorInjected = true;

  const scriptContent = `
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        if (typeof url === 'string' && url.includes('password-game/street-view')) {
          const clone = response.clone();
          clone.json().then(data => {
            if (data && data.country) {
              window.postMessage({ type: "PWG_GEO_HACK", country: data.country }, "*");
            }
          }).catch(e => {});
        }
      } catch (e) {}
      return response;
    };
  `;

  const script = document.createElement('script');
  script.textContent = scriptContent;
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "PWG_GEO_HACK") {
      return;
    }
    (window as any).__pwgCountryAnswer = event.data.country;
    console.log("[PWG] 🗺️ GeoGuessr intercepted! Setting country:", event.data.country);
  });
}

async function init() {
  injectInterceptor();

  const domReader = new DOMReader();
  const domWriter = new DOMWriter();
  const domObserver = new DOMObserver();
  const engine = new PasswordEngine();
  const budget = new BudgetTracker();
  const classifier = new RuleClassifier();

  const humanHandler = new HumanHandler();
  const numericSolver = new NumericSolver();

  const handlers = new Map<string, Handler>();
  handlers.set("text", new TextHandler());
  handlers.set("numeric", new NumericHandler(numericSolver));
  handlers.set("human", humanHandler);
  handlers.set("pattern", new PatternHandler());
  handlers.set("time", new TimeHandler());
  handlers.set("external", new ExternalHandler(humanHandler));

  const conflictResolver = new ConflictResolver(numericSolver, handlers);

  const mainLoop = new MainLoop(
    domReader,
    domWriter,
    domObserver,
    engine,
    budget,
    classifier,
    numericSolver,
    conflictResolver,
    handlers,
    humanHandler
  );

  mainLoop.start();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
