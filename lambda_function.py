from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import numpy as np
from feature_extr import FeatureExtraction
import json
from mangum import Mangum

app = Flask(__name__)

# Configure CORS to accept requests from Chrome extension
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*"],
        "methods": ["POST", "OPTIONS", "GET"],
        "allow_headers": ["Content-Type"]
    }
})

# Load your Gradient Boosting model
model = pickle.load(open("gbc_final_model.pkl", "rb"))

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "SafeLink API is running!"})

@app.route("/api/detect", methods=["POST", "OPTIONS"])
def detect_phishing():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        data = request.get_json()
        url = data.get("url")
        if not url:
            return jsonify({"error": "No URL provided"}), 400

        # Extract features from the URL
        fe = FeatureExtraction(url)
        features = np.array(fe.getFeaturesList()).reshape(1, 30)

        # Predict using the loaded model
        prediction = model.predict(features)[0]

        # Return a JSON response
        if prediction == 1:
            return jsonify({"result": "Legitimate"})
        else:
            return jsonify({"result": "Potential Phishing"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/features', methods=['POST', 'OPTIONS'])
def get_features():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

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
        feature_names = [
            'UsingIP', 'LongURL', 'ShortURL', 'Symbol@', 'Redirecting//', 
            'PrefixSuffix-', 'SubDomains', 'HTTPS', 'DomainRegLen', 'Favicon',
            'NonStdPort', 'HTTPSDomainURL', 'RequestURL', 'AnchorURL', 'LinksInScriptTags',
            'ServerFormHandler', 'InfoEmail', 'AbnormalURL', 'WebsiteForwarding', 'StatusBarCust',
            'DisableRightClick', 'UsingPopupWindow', 'IframeRedirection', 'AgeofDomain', 'DNSRecording',
            'WebsiteTraffic', 'PageRank', 'GoogleIndex', 'LinksPointingToPage', 'StatsReport'
        ]
        
        features_dict = dict(zip(feature_names, features))
        
        response_data = {
            'url': url,
            'features': features_dict
        }
        
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Create the Mangum handler
handler = Mangum(app)

if __name__ == "__main__":
    app.run(debug=True) 