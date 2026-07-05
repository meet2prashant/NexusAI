import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

model = genai.GenerativeModel('gemini-2.5-flash-lite')
messages = [
    {'role': 'user', 'parts': ['You are an assistant.']},
    {'role': 'model', 'parts': ['Understood']},
    {'role': 'user', 'parts': ['Retrieved RAG:\nNo context found.\n\nQ: What is the album name?']}
]

try:
    resp = model.generate_content(messages, stream=True)
    for chunk in resp:
        print("CHUNK:", chunk.text)
except Exception as e:
    print("ERROR:", str(e))
