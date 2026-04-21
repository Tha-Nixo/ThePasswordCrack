"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content/inject.ts
  var require_inject = __commonJS({
    "src/content/inject.ts"() {
      var originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
          const url = args[0] instanceof Request ? args[0].url : args[0];
          if (typeof url === "string" && url.includes("password-game/street-view")) {
            const clone = response.clone();
            clone.json().then((data) => {
              if (data && data.country) {
                window.postMessage({ type: "PWG_GEO_HACK", country: data.country }, "*");
              }
            }).catch((e) => {
            });
          }
        } catch (e) {
        }
        return response;
      };
    }
  });
  require_inject();
})();
//# sourceMappingURL=inject.js.map
