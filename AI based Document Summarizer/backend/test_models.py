import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("NO API KEY")
    exit()

genai.configure(api_key=api_key)

print("\n--- AUTHORIZED MODELS FOR GENERATE_CONTENT ---")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
