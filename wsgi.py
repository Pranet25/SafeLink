import sys
import os

# Add your project directory to the sys.path
project_home = '/home/yourusername/safelink'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Import your Flask app
from server import app as application

# This is the PythonAnywhere WSGI configuration
if __name__ == '__main__':
    application.run() 