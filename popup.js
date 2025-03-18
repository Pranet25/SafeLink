// Use production URL for the API
const API_BASE_URL = 'https://safelink-api-0u29.onrender.com';

// Function to show error in the result div
function showError(message) {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = message;
  resultDiv.className = 'result phish';
}

// Function to store URL analysis result
async function storeAnalysisResult(url, result) {
  await chrome.storage.local.set({
    'lastAnalysis': {
      url: url,
      result: result,
      timestamp: new Date().toISOString()
    }
  });
}

// Function to get stored analysis result
async function getStoredAnalysis() {
  const data = await chrome.storage.local.get('lastAnalysis');
  return data.lastAnalysis;
}

// Function to store feature details
async function storeFeatureDetails(url, features) {
  await chrome.storage.local.set({
    'lastFeatures': {
      url: url,
      features: features,
      timestamp: new Date().toISOString()
    }
  });
}

// Function to check URL
async function checkUrl(urlToCheck = null) {
  const urlInput = document.getElementById('urlInput');
  const resultDiv = document.getElementById('result');
  const moreInfo = document.getElementById('moreInfo');

  // If no URL is provided, get it from the input field
  const url = urlToCheck || urlInput.value.trim();
  
  if (!url) {
    resultDiv.textContent = 'Please enter a URL.';
    resultDiv.className = 'result';
    return;
  }

  // Set the URL in the input field if it came from context menu
  if (urlToCheck) {
    urlInput.value = urlToCheck;
  }

  // Indicate checking in progress
  resultDiv.textContent = 'Checking...';
  resultDiv.className = 'result';

  try {
    // First check if server is running
    const serverCheck = await fetch(API_BASE_URL, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors'
    }).catch(() => null);

    if (!serverCheck || !serverCheck.ok) {
      throw new Error('Cannot connect to server. Make sure the Flask server is running at http://127.0.0.1:5000');
    }

    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    // Make a POST request to the Flask server
    const response = await fetch(`${API_BASE_URL}/detect`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      body: JSON.stringify({ url: url }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || !data.result) {
      throw new Error('Invalid response from server');
    }

    const result = data.result;
    
    // Store the analysis result
    await storeAnalysisResult(url, result);

    if (result === 'Legitimate') {
      resultDiv.textContent = 'URL Status: Legitimate';
      resultDiv.className = 'result legit';
    } else {
      resultDiv.textContent = 'URL Status: Potential Phishing';
      resultDiv.className = 'result phish';
    }

    // Show feature details link
    moreInfo.style.display = 'block';
    moreInfo.onclick = async (e) => {
      e.preventDefault();
      try {
        const response = await fetch(`${API_BASE_URL}/features`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          body: JSON.stringify({ url: url })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch feature details');
        }

        const data = await response.json();
        if (!data.features || Object.keys(data.features).length === 0) {
          throw new Error('No feature data received from server');
        }
        
        // Store the feature details
        await storeFeatureDetails(url, data.features);
        
        // Open features.html in a new tab with the feature data
        const featuresUrl = new URL(chrome.runtime.getURL('features.html'));
        featuresUrl.searchParams.set('url', encodeURIComponent(data.url));
        
        // Ensure features are properly formatted before encoding
        const cleanedFeatures = {};
        Object.entries(data.features).forEach(([key, value]) => {
          cleanedFeatures[key] = typeof value === 'number' ? value : (value ? 1 : 0);
        });
        
        const encodedFeatures = encodeURIComponent(JSON.stringify(cleanedFeatures));
        featuresUrl.searchParams.set('features', encodedFeatures);
        
        chrome.tabs.create({ url: featuresUrl.toString() });
      } catch (error) {
        console.error('Error fetching feature details:', error);
        showError('Failed to load feature details. Make sure the Flask server is running.');
      }
    };
  } catch (error) {
    console.error('Error checking URL:', error);
    if (error.name === 'AbortError') {
      showError('Request timed out. Please check if the server is running.');
    } else if (error.message.includes('Failed to fetch')) {
      showError('Cannot connect to server. Make sure the Flask server is running at http://127.0.0.1:5000');
    } else {
      showError(error.message || 'An error occurred while checking the URL.');
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "checkContextMenuUrl") {
        checkUrl(request.url);
    }
});

// Check for stored URL and analysis when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // First check for context menu URL
        const contextMenuData = await chrome.storage.local.get('contextMenuUrl');
        if (contextMenuData.contextMenuUrl) {
            const url = contextMenuData.contextMenuUrl;
            // Clear the stored context menu URL immediately
            await chrome.storage.local.remove('contextMenuUrl');
            // Check the URL
            await checkUrl(url);
        }
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
        showError('Error loading URL: ' + error.message);
    }
});

// Add click event listener to the button
document.getElementById('checkBtn').addEventListener('click', () => checkUrl());

// Add keypress event listener to the input field
document.getElementById('urlInput').addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    checkUrl();
  }
});

// Add click event listener to the feature details link
document.getElementById('moreInfo').addEventListener('click', async (e) => {
  e.preventDefault();
  const urlInput = document.getElementById('urlInput');
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a URL first');
    return;
  }

  try {
    // Show loading state
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = 'Fetching feature details...';
    resultDiv.className = 'result';

    const response = await fetch(`${API_BASE_URL}/features`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch feature details');
    }

    const data = await response.json();
    if (!data.features || Object.keys(data.features).length === 0) {
      throw new Error('No feature data received from server');
    }
    
    // Store the feature details
    await storeFeatureDetails(url, data.features);
    
    // Open features.html in a new tab with the feature data
    const featuresUrl = new URL(chrome.runtime.getURL('features.html'));
    featuresUrl.searchParams.set('url', encodeURIComponent(data.url));
    
    // Ensure features are properly formatted before encoding
    const cleanedFeatures = {};
    Object.entries(data.features).forEach(([key, value]) => {
      cleanedFeatures[key] = typeof value === 'number' ? value : (value ? 1 : 0);
    });
    
    const encodedFeatures = encodeURIComponent(JSON.stringify(cleanedFeatures));
    featuresUrl.searchParams.set('features', encodedFeatures);
    
    chrome.tabs.create({ url: featuresUrl.toString() });
    
    // Reset the result div
    resultDiv.textContent = 'Feature details opened in new tab';
    resultDiv.className = 'result';
  } catch (error) {
    showError('Failed to load feature details. Make sure the Flask server is running.');
  }
});