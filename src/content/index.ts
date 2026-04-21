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

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    
    if (event.data.type === "PWG_GEO_HACK") {
      (window as any).__pwgCountryAnswer = event.data.country;
      console.log("[PWG] 🗺️ GeoGuessr intercepted! Setting country:", event.data.country);
    }
    
    if (event.data.type === "PWG_SPY_CANDIDATE") {
      console.log("[PWG] 🕵️ Spy caught potential string:", event.data.str);
      if (!(window as any).__pwgCountryAnswer) {
        (window as any).__pwgCountryAnswer = event.data.str;
      }
    }
  });

async function init() {

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
