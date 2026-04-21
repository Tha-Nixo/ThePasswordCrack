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
    }
  });
  require_inject();
})();
//# sourceMappingURL=inject.js.map
