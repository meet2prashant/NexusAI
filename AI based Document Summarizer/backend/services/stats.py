import json
import os

STATS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "stats.json")

def init_stats():
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    if not os.path.exists(STATS_FILE):
        with open(STATS_FILE, "w") as f:
            json.dump({"total_documents": 0, "total_chats": 0, "languages": {}}, f)

def get_stats() -> dict:
    init_stats()
    with open(STATS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {"total_documents": 0, "total_chats": 0, "languages": {}}

def save_stats(data: dict):
    with open(STATS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

def increment_document(lang: str):
    stats = get_stats()
    stats["total_documents"] += 1
    stats["languages"][lang] = stats["languages"].get(lang, 0) + 1
    save_stats(stats)

def increment_chat():
    stats = get_stats()
    stats["total_chats"] += 1
    save_stats(stats)
