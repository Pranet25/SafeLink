// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "checkUrl",
        title: "Check URL for phishing",
        contexts: ["link"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "checkUrl" && info.linkUrl) {
        try {
            // Store the URL to be checked
            await chrome.storage.local.set({ 'contextMenuUrl': info.linkUrl });
            
            // Get the current window
            const window = await chrome.windows.getCurrent();
            
            // Open the extension popup
            await chrome.action.openPopup();
            
            // Send a message to the popup to check the URL
            chrome.runtime.sendMessage({
                action: "checkContextMenuUrl",
                url: info.linkUrl
            });
        } catch (error) {
            console.error('Error in context menu handler:', error);
        }
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStoredUrl") {
        // Get and clear the stored URL
        chrome.storage.local.get('contextMenuUrl', (data) => {
            if (data.contextMenuUrl) {
                sendResponse({ url: data.contextMenuUrl });
                // Clear the stored URL after sending
                chrome.storage.local.remove('contextMenuUrl');
            } else {
                sendResponse({ url: null });
            }
        });
        return true; // Will respond asynchronously
    }
});

// Keep service worker active
chrome.runtime.onConnect.addListener(function(port) {
    port.onDisconnect.addListener(function() {
        // Service worker will stay alive
    });
});
  