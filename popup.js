// Use production URL for the API
const API_BASE_URL = 'https://safelink-api-0u29.onrender.com';

// Function to show error in the result div
function showError(message) {
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = message;
  resultDiv.className = 'result phish';
}

// Function to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Function to retry fetch with exponential backoff
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // If we get a 502, wait and retry
      if (response.status === 502) {
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
        await delay(waitTime);
        continue;
      }
      
      return response; // Return other status codes
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const waitTime = Math.pow(2, i) * 1000;
      await delay(waitTime);
    }
  }
  throw new Error('Max retries reached');
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

// Function to handle feature details click
async function handleFeatureDetailsClick(e, url) {
  e.preventDefault();
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/features`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      mode: 'cors',
      body: JSON.stringify({ url: url })
    });

    if (!response.ok) {
      if (response.status === 502) {
        throw new Error('Server is warming up. Please try again in a few moments.');
      }
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
    showError(error.message || 'Failed to load feature details. Please try again in a few moments.');
  }
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
  try {
    new URL(url);
  } catch (error) {
    resultDiv.textContent = 'Please enter a valid URL (e.g., https://www.example.com)';
    resultDiv.className = 'result phish';
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
    // First check if server is running with retry
    const serverCheck = await fetchWithRetry(API_BASE_URL, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      mode: 'cors'
    });

    // Add timeout to the fetch request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout to 15 seconds

    // Make a POST request to the Flask server with retry
    const response = await fetchWithRetry(`${API_BASE_URL}/detect`, {
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
      if (response.status === 502) {
        throw new Error('Server is warming up. Please try again in a few moments.');
      }
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

    // Show feature details link and set up click handler
    moreInfo.style.display = 'block';
    moreInfo.onclick = (e) => handleFeatureDetailsClick(e, url);
  } catch (error) {
    console.error('Error checking URL:', error);
    if (error.name === 'AbortError') {
      showError('Request timed out. Please try again in a few moments.');
    } else if (error.message.includes('Failed to fetch')) {
      showError('Cannot connect to server. Please try again in a few moments.');
    } else {
      showError(error.message || 'An error occurred while checking the URL.');
    }
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkContextMenuUrl") {
    checkUrl(message.url);
  }
});

// When the popup is opened, check if there's a stored URL from context menu
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const urlInput = document.getElementById('urlInput');
    urlInput.value = ''; // Clear input on load

    const storedAnalysis = await getStoredAnalysis();
    if (storedAnalysis) {
      console.log("Stored Analysis Found:", storedAnalysis);
    }
  } catch (error) {
    console.error('Error checking stored analysis:', error);
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