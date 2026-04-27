const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  try {
    const urlRaw = args[0] instanceof Request ? args[0].url : args[0];
    const urlStr = urlRaw ? urlRaw.toString() : '';
    // console.log("[PWG Injector] fetch intercepted:", urlStr);

    if (urlStr.includes('password-game/street-view') || urlStr.includes('api/password-game')) {
      console.log("[PWG Injector] Found Street View request:", urlStr);
      const clone = response.clone();
      clone.json().then(data => {
        console.log("[PWG Injector] Geo data received:", data);
        if (data && data.country) {
          window.postMessage({ type: "PWG_GEO_HACK", country: data.country }, "*");
        }
      }).catch(e => {});
    }
  } catch (e) {}
  return response;
};

// XMLHttpRequest Interceptor
const XHR = XMLHttpRequest.prototype;
const open = XHR.open;
const send = XHR.send;

XHR.open = function(method: string, url: string | URL) {
    this._url = url.toString();
    return open.apply(this, arguments as any);
};

XHR.send = function(postData?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener('load', function() {
        const urlStr = this._url || '';
        // console.log("[PWG Injector] XHR intercepted:", urlStr);
        if (urlStr.includes('password-game/street-view') || urlStr.includes('api/password-game')) {
            console.log("[PWG Injector] Found Street View XHR request:", urlStr);
            try {
                const text = this.responseText;
                const data = JSON.parse(text);
                console.log("[PWG Injector] Geo XHR data received:", data);
                if (data && data.country) {
                    window.postMessage({ type: "PWG_GEO_HACK", country: data.country }, "*");
                }
            } catch(e) {}
        }
    });
    return send.apply(this, arguments as any);
};

// ==========================================
// THE PASSWORD SPY
// We hook string comparison methods to catch what the game is comparing our password against!
// Since we know our password contains "Helicopter" or "pepsi", we only log when 'this' is our password.
// ==========================================

const originalIncludes = String.prototype.includes;

const isOurPassword = (str: string | undefined | null) => {
    if (typeof str !== 'string') return false;
    return originalIncludes.call(str, 'Helicopter') || originalIncludes.call(str, 'pepsi') || originalIncludes.call(str, '399');
};

String.prototype.includes = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!['Helicopter', 'pepsi', '399', 'clump', 'snore'].includes(searchString)) {
            console.log("[PWG Spy] includes() called with:", searchString);
            window.postMessage({ type: 'PWG_SPY_INCLUDES', str: searchString }, "*");
        }
    }
    return originalIncludes.call(this, searchString, position);
};

const originalIndexOf = String.prototype.indexOf;
String.prototype.indexOf = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!['Helicopter', 'pepsi', '399', 'clump', 'snore'].includes(searchString)) {
            console.log("[PWG Spy] indexOf() called with:", searchString);
            window.postMessage({ type: 'PWG_SPY_INCLUDES', str: searchString }, "*");
        }
    }
    return originalIndexOf.call(this, searchString, position);
};

const originalMatch = String.prototype.match;
String.prototype.match = function(regexp: any) {
    if (isOurPassword(this as unknown as string)) {
        console.log("[PWG Spy] match() called with:", regexp);
    }
    return originalMatch.call(this, regexp);
};

const originalTest = RegExp.prototype.test;
RegExp.prototype.test = function(str: any) {
    if (isOurPassword(str)) {
        console.log("[PWG Spy] RegExp check:", this.source);
        // Do NOT send regex sources as candidates — they are patterns like \d, \n$, [A-Z] etc.
        // Country detection uses includes(), not regex, so this would only pollute the results.
    }
    return originalTest.call(this, str);
};

let dumpedGeoState = false;
setInterval(() => {
    if (dumpedGeoState) return;
    const geoEl = document.querySelector('.geo-guessr, .street-view');
    if (geoEl && (window as any).__NUXT__) {
        dumpedGeoState = true;
        console.log("[PWG NuxtSpy] 🗺️ Dumping Nuxt state to find country...");
        try {
            console.log(JSON.stringify((window as any).__NUXT__.state, null, 2));
        } catch (e) {
            console.log("Could not stringify:", (window as any).__NUXT__);
        }
    }
}, 2000);
