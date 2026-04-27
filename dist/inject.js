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
          const urlRaw = args[0] instanceof Request ? args[0].url : args[0];
          const urlStr = urlRaw ? urlRaw.toString() : "";
          if (urlStr.includes("password-game/street-view") || urlStr.includes("api/password-game")) {
            console.log("[PWG Injector] Found Street View request:", urlStr);
            const clone = response.clone();
            clone.json().then((data) => {
              console.log("[PWG Injector] Geo data received:", data);
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
      var XHR = XMLHttpRequest.prototype;
      var open = XHR.open;
      var send = XHR.send;
      XHR.open = function(method, url) {
        this._url = url.toString();
        return open.apply(this, arguments);
      };
      XHR.send = function(postData) {
        this.addEventListener("load", function() {
          const urlStr = this._url || "";
          if (urlStr.includes("password-game/street-view") || urlStr.includes("api/password-game")) {
            console.log("[PWG Injector] Found Street View XHR request:", urlStr);
            try {
              const text = this.responseText;
              const data = JSON.parse(text);
              console.log("[PWG Injector] Geo XHR data received:", data);
              if (data && data.country) {
                window.postMessage({ type: "PWG_GEO_HACK", country: data.country }, "*");
              }
            } catch (e) {
            }
          }
        });
        return send.apply(this, arguments);
      };
      var originalIncludes = String.prototype.includes;
      function isOurPassword(str) {
        if (!str || typeof str !== "string" || str.length < 5) return false;
        const lowerStr = str.toLowerCase();
        return originalIncludes.call(lowerStr, "strongpassword") || originalIncludes.call(lowerStr, "may");
      }
      String.prototype.includes = function(searchString, position) {
        if (isOurPassword(this) && typeof searchString === "string" && searchString.length > 2) {
          if (!["Helicopter", "pepsi", "399", "clump", "snore"].includes(searchString)) {
            console.log("[PWG Spy] includes() called with:", searchString);
            window.postMessage({ type: "PWG_SPY_INCLUDES", str: searchString }, "*");
          }
        }
        return originalIncludes.call(this, searchString, position);
      };
      var originalIndexOf = String.prototype.indexOf;
      String.prototype.indexOf = function(searchString, position) {
        if (isOurPassword(this) && typeof searchString === "string" && searchString.length > 2) {
          if (!["Helicopter", "pepsi", "399", "clump", "snore"].includes(searchString)) {
            console.log("[PWG Spy] indexOf() called with:", searchString);
            window.postMessage({ type: "PWG_SPY_INCLUDES", str: searchString }, "*");
          }
        }
        return originalIndexOf.call(this, searchString, position);
      };
      var originalMatch = String.prototype.match;
      String.prototype.match = function(regexp) {
        if (isOurPassword(this)) {
          console.log("[PWG Spy] match() called with:", regexp);
        }
        return originalMatch.call(this, regexp);
      };
      var originalTest = RegExp.prototype.test;
      RegExp.prototype.test = function(str) {
        if (isOurPassword(str)) {
          console.log("[PWG Spy] RegExp check:", this.source);
        }
        return originalTest.call(this, str);
      };
      var dumpedGeoState = false;
      setInterval(() => {
        if (dumpedGeoState) return;
        const geoEl = document.querySelector(".geo-guessr, .street-view");
        if (geoEl && window.__NUXT__) {
          dumpedGeoState = true;
          console.log("[PWG NuxtSpy] \u{1F5FA}\uFE0F Dumping Nuxt state to find country...");
          try {
            console.log(JSON.stringify(window.__NUXT__.state, null, 2));
          } catch (e) {
            console.log("Could not stringify:", window.__NUXT__);
          }
        }
      }, 2e3);
    }
  });
  require_inject();
})();
//# sourceMappingURL=inject.js.map
