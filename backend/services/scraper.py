import requests
from bs4 import BeautifulSoup
import re

def scrape_url_to_text(url: str) -> str:
    """
    Downloads and extracts the core textual content from a webpage.
    Attempts to use an LLM-optimized reader API first to handle Javascript-heavy SPAs,
    then securely falls back to a vanilla BeautifulSoup native parser.
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        
        # PROXY METHOD: Attempt to use the phenomenal Jina Reader API for perfect AI Markdown extraction
        try:
            jina_headers = {'User-Agent': 'NexusAI/1.0'}
            jina_response = requests.get(f"https://r.jina.ai/{url}", headers=jina_headers, timeout=12)
            if jina_response.status_code == 200:
                clean_text = jina_response.text.strip()
                if len(clean_text) > 100 and "blocked" not in clean_text.lower():
                    return clean_text
        except Exception as e:
            print(f"Advanced extracting proxy failed, initiating standard fallback parser... ({e})")

        # NATIVE FALLBACK: Execute vanilla BeautifulSoup extraction locally
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Brutally sanitize out non-text structural elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "form", "button", "iframe"]):
            element.extract()

        # Specifically target the exact elements most likely to hold the content
        text_elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'article', 'section'])
        
        extracted_text = []
        for element in text_elements:
            text = element.get_text(separator=' ', strip=True)
            # Filter out incredibly short UI-garabage strings
            if text and len(text) > 20: 
                extracted_text.append(text)

        raw_text = "\n\n".join(extracted_text)
        
        # Formatting cleanup
        clean_text = re.sub(r'\n{3,}', '\n\n', raw_text)
        
        if len(clean_text) < 50:
             raise ValueError("Extracted content is minimal. The website might be empty, require JavaScript, or block automated extraction.")

        return clean_text

    except requests.RequestException as e:
        raise ValueError(f"Failed to fetch URL data: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to parse webpage: {str(e)}")
