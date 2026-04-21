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
