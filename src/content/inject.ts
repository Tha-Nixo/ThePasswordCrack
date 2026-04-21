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

const isOurPassword = (str: string | undefined | null) => {
    return typeof str === 'string' && (str.includes('Helicopter') || str.includes('pepsi') || str.includes('399'));
};

const originalIncludes = String.prototype.includes;
String.prototype.includes = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!['Helicopter', 'pepsi', '399', 'clump', 'snore'].includes(searchString)) {
            console.log("[PWG Spy] includes() called with:", searchString);
            window.postMessage({ type: 'PWG_SPY_CANDIDATE', str: searchString }, "*");
        }
    }
    return originalIncludes.call(this, searchString, position);
};

const originalIndexOf = String.prototype.indexOf;
String.prototype.indexOf = function(searchString: any, position?: number) {
    if (isOurPassword(this as unknown as string) && typeof searchString === 'string' && searchString.length > 2) {
        if (!['Helicopter', 'pepsi', '399', 'clump', 'snore'].includes(searchString)) {
            console.log("[PWG Spy] indexOf() called with:", searchString);
            window.postMessage({ type: 'PWG_SPY_CANDIDATE', str: searchString }, "*");
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
        window.postMessage({ type: 'PWG_SPY_CANDIDATE', str: this.source }, "*");
    }
    return originalTest.call(this, str);
};

