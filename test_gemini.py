import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))

# Try to upload an image and chat with it
with open('test_img.txt', 'w') as f: f.write('fake image')
print('Uploading dummy text file as Gemini File to test file API...')
try:
    gemini_file = genai.upload_file('backend/main.py')
    print(f"Uploaded: {gemini_file.name}")
    
    model = genai.GenerativeModel('gemini-2.5-flash-lite')
    resp = model.generate_content([gemini_file, "What is the name of the app?"])
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
