export {};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOG") {
    console.log(`[Content] ${message.msg}`);
  } else if (message.type === "FETCH_WORDLE") {
    fetch(message.url)
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.toString() }));
    return true; // Keep message channel open for async response
  }
});
