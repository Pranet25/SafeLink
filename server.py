from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
import pandas as pd
import warnings
import os
from feature_extr import FeatureExtraction

# Suppress scikit-learn warnings about feature names
warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')

app = Flask(__name__)

# Configure CORS to accept requests from Chrome extension and production domain
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*", "https://*.onrender.com"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "supports_credentials": False
    }
})

# Set Flask secret key from environment variable
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-key-please-change-in-production')

# Load your Gradient Boosting model
model = pickle.load(open("gbc_final_model.pkl", "rb"))

# Define feature names that match the model's training data
feature_names = [
    'UsingIP', 'LongURL', 'ShortURL', 'Symbol@', 'Redirecting//', 
    'PrefixSuffix-', 'SubDomains', 'HTTPS', 'DomainRegLen', 'Favicon',
    'NonStdPort', 'HTTPSDomainURL', 'RequestURL', 'AnchorURL', 'LinksInScriptTags',
    'ServerFormHandler', 'InfoEmail', 'AbnormalURL', 'WebsiteForwarding', 'StatusBarCust',
    'DisableRightClick', 'UsingPopupWindow', 'IframeRedirection', 'AgeofDomain', 'DNSRecording',
    'WebsiteTraffic', 'PageRank', 'GoogleIndex', 'LinksPointingToPage', 'StatsReport'
]

@app.route("/", methods=["GET"])
def home():
    response = jsonify({"status": "SafeLink API is running!"})
    return response

@app.route("/detect", methods=["POST", "OPTIONS"])
def detect_phishing():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    try:
        data = request.get_json()
        url = data.get("url")
        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Extract features from the URL
        fe = FeatureExtraction(url)
        features = np.array(fe.getFeaturesList()).reshape(1, -1)

        # Create a DataFrame with feature names
        features_df = pd.DataFrame(features, columns=feature_names)

        # Predict using the loaded model
        prediction = model.predict(features_df)[0]

        # Return a JSON response
        return jsonify({"result": "Legitimate" if prediction == 1 else "Potential Phishing"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/features', methods=['POST', 'OPTIONS'])
def get_features():
    if request.method == "OPTIONS":
        return jsonify({"status": "ok"})

    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400

        # Extract features using FeatureExtraction class
        fe = FeatureExtraction(url)
        features = fe.getFeaturesList()
        
        # Convert features to a list if it's a numpy array
        if isinstance(features, np.ndarray):
            features = features.tolist()
        
        # Create a dictionary of features
        features_dict = dict(zip(feature_names, features))
        
        response_data = {
            'url': url,
            'features': features_dict
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
