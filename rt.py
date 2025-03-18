import pickle
import warnings
import numpy as np
from feature_extr import FeatureExtraction
# Suppress specific warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")
gbc = pickle.load(open("gbc_final_model.pkl","rb"))
if __name__ == "__main__":
    url = input("Enter URL to analyze: ")
    obj = FeatureExtraction(url)
x = np.array(obj.getFeaturesList()).reshape(1,30)
print("Feature Array: ",x)
y_pro_phishing = gbc.predict_proba(x)[0,0]
y_pro_non_phishing = gbc.predict_proba(x)[0,1]
y_pred =gbc.predict(x)[0]
print("Prediction = ",y_pred)
if y_pred==1:
  print("It is a legitimate website")
else:
  print("*Suspicious website detected*")