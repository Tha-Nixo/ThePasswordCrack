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
// Since we know our password contains "strongpassword" or "may", we only log when 'this' is our password.
// ==========================================

const originalIncludes = String.prototype.includes;

function isOurPassword(str: string): boolean {
    if (!str || typeof str !== 'string' || str.length < 5) return false;
    
    // By the time we need the spy, the password is usually long.
    if (str.length > 30) return true;
    
    const lowerStr = str.toLowerCase();
    return originalIncludes.call(lowerStr, 'a!111') || 
           originalIncludes.call(lowerStr, 'a!') ||
           originalIncludes.call(lowerStr, 'strongpassword') || 
           originalIncludes.call(lowerStr, 'february') ||
           originalIncludes.call(lowerStr, 'pepsi') ||
           originalIncludes.call(lowerStr, 'may');
}

// Known strings to ignore in spy logging (browser noise, common technical strings)
const SPY_IGNORE = new Set([
    'Helicopter', 'pepsi', 'strongpassword', 'a!111', '399', '699', 'clump', 'snore', 
    'Chrome', 'Safari', 'Firefox', 'Opera', 'Edge', 'Mozilla', 'WebKit', 'Gecko', 'Trident', 'Presto',
    'chrome', 'safari', 'firefox', 'opera', 'edge', 'mozilla', 'webkit', 'gecko', 'trident', 'presto',
    'Mac', 'Windows', 'Android', 'iOS', 'iPhone', 'iPad', 'iPod', 'Silk', 'IEMobile', 'Blink',
    'mac', 'windows', 'android', 'ios', 'iphone', 'ipad', 'ipod', 'linux',
    'password-game/street-view', 'api/password-game', 'bt_debug', 'coolmathgames.com',
    'google_debug', 'googfc', 'google_console', 'dfpdeb', 'googletag', 'securepubads',
    'native', 'code', 'function', 'object', 'string', 'number', 'boolean'
]);

// Known affirmation/wordle/sponsor strings the game checks (not captchas)
const KNOWN_CHECKS = new Set([
    'starbucks', 'shell', 'pepsi',
    'i am loved', 'i am worthy', 'i am enough',
    'iamloved', 'iamworthy', 'iamenough',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
    'eerie', 'quack',
    'webkit', 'safari', 'mozilla', 'chrome' // Safety redundancy
]);

String.prototype.includes = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!SPY_IGNORE.has(searchString)) {
            console.log("[PWG Spy] includes() called with:", searchString);
            window.postMessage({ type: 'PWG_SPY_INCLUDES', str: searchString }, "*");
        }
    }
    return originalIncludes.call(this, searchString, position);
};

const originalIndexOf = String.prototype.indexOf;
String.prototype.indexOf = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!SPY_IGNORE.has(searchString)) {
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
