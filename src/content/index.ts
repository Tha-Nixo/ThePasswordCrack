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
import { SacrificeHandler } from "./handlers/sacrifice";
import { Handler } from "../shared/types";

  // Known country names the game checks against (lowercase, no spaces)
  const KNOWN_COUNTRIES = new Set([
    "afghanistan","albania","algeria","andorra","angola","antigua","argentina","armenia",
    "australia","austria","azerbaijan","bahamas","bahrain","bangladesh","barbados","belarus",
    "belgium","belize","benin","bhutan","bolivia","bosnia","botswana","brazil","brunei",
    "bulgaria","burkina","burundi","cambodia","cameroon","canada","capeverde","chad","chile",
    "china","colombia","comoros","congo","costarica","croatia","cuba","cyprus","czechrepublic",
    "denmark","djibouti","dominica","dominicanrepublic","easttimor","ecuador","egypt",
    "elsalvador","equatorialguinea","eritrea","estonia","ethiopia","fiji","finland","france",
    "gabon","gambia","georgia","germany","ghana","greece","grenada","guatemala","guinea",
    "guinea-bissau","guyana","haiti","honduras","hungary","iceland","india","indonesia",
    "iran","iraq","ireland","israel","italy","ivorycoast","jamaica","japan","jordan",
    "kazakhstan","kenya","kiribati","koreanorth","koreasouth","kosovo","kuwait","kyrgyzstan",
    "laos","latvia","lebanon","lesotho","liberia","libya","liechtenstein","lithuania",
    "luxembourg","macedonia","madagascar","malawi","malaysia","maldives","mali","malta",
    "marshallislands","mauritania","mauritius","mexico","micronesia","moldova","monaco",
    "mongolia","montenegro","morocco","mozambique","myanmar","namibia","nauru","nepal",
    "netherlands","newzealand","nicaragua","niger","nigeria","norway","oman","pakistan",
    "palau","panama","papuanewguinea","paraguay","peru","philippines","poland","portugal",
    "qatar","romania","russia","rwanda","stlucia","samoa","sanmarino","saudiarabia",
    "senegal","serbia","seychelles","sierraleone","singapore","slovakia","slovenia",
    "solomonislands","somalia","southafrica","southsudan","spain","srilanka","sudan",
    "suriname","swaziland","sweden","switzerland","syria","taiwan","tajikistan","tanzania",
    "thailand","togo","tonga","trinidad&tobago","tunisia","turkey","turkmenistan","tuvalu",
    "uganda","ukraine","unitedarabemirates","unitedkingdom","america","uruguay","uzbekistan",
    "vanuatu","vaticancity","venezuela","vietnam","yemen","zambia","zimbabwe","england",
    "unitedstates","britain"
  ]);

  // The game checks password.includes(correctCountry) FIRST, then iterates all countries
  // alphabetically. So the first country match from the spy is the answer.
  let countryBatchSeen = false;

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    
    // Direct intercept from fetch/XHR (highest priority)
    if (event.data.type === "PWG_GEO_HACK") {
      (window as any).__pwgCountryAnswer = event.data.country;
      console.log("[PWG] 🗺️ GeoGuessr intercepted via API! Country:", event.data.country);
    }
    
  // Known affirmation/sponsor/wordle strings that are NOT captchas
  const KNOWN_GAME_STRINGS = new Set([
    "starbucks", "shell", "pepsi",
    "i am loved", "i am worthy", "i am enough",
    "iamloved", "iamworthy", "iamenough",
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "eerie", "quack"
  ]);

    // Spy intercept from includes()/indexOf() calls
    if (event.data.type === "PWG_SPY_INCLUDES") {
      const candidate = event.data.str;
      
      // Chess move detection — algebraic notation like Rf1+, Nxe4, O-O, e8=Q
      // Must check BEFORE country check since some chess moves could collide
      const CHESS_REGEX = /^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?$/;
      const CASTLING_REGEX = /^O-O(?:-O)?[+#]?$/;
      if (!( window as any).__pwgChessAnswer && (CHESS_REGEX.test(candidate) || CASTLING_REGEX.test(candidate))) {
        // Make sure it's not a known country or other common string
        if (!KNOWN_COUNTRIES.has(candidate.toLowerCase())) {
          (window as any).__pwgChessAnswer = candidate;
          console.log("[PWG] ♟️ Chess move detected from spy:", candidate);
        }
      }
      
      // Only consider strings that match known country names
      if (KNOWN_COUNTRIES.has(candidate)) {
        // The game checks the correct country FIRST before the alphabetical loop.
        // If we haven't seen a country batch yet, the first country IS the answer.
        if (!countryBatchSeen) {
          countryBatchSeen = true;
          (window as any).__pwgCountryAnswer = candidate;
          console.log("[PWG] 🗺️ Country detected from spy (first match):", candidate);
          
          // Reset the batch flag after a short delay so we can detect new GeoGuessr rounds
          setTimeout(() => { countryBatchSeen = false; }, 3000);
        }
      }

      // CAPTCHA detection — short alphanumeric string that isn't a country, chess move, or known keyword
      // The game checks password.includes(captchaText) where captchaText is typically 5 chars, lowercase alphanumeric
      const candidateLower = candidate.toLowerCase();
      if (
        !( window as any).__pwgCaptchaAnswer &&
        candidate.length >= 3 && candidate.length <= 8 &&
        /^[a-z0-9]+$/i.test(candidate) &&
        !KNOWN_COUNTRIES.has(candidateLower) &&
        !KNOWN_GAME_STRINGS.has(candidateLower) &&
        !CHESS_REGEX.test(candidate) &&
        !CASTLING_REGEX.test(candidate)
      ) {
        (window as any).__pwgCaptchaAnswer = candidate;
        console.log("[PWG] 🔤 CAPTCHA detected from spy:", candidate);
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
  handlers.set("sacrifice", new SacrificeHandler(domWriter));

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
