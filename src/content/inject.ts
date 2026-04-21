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
