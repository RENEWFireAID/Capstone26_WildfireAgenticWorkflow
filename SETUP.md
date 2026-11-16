# FireAID Web - Setup Guide for Team Members

## 🔑 Required: Environment Variables

Create a `.env` file in the project root (next to `docker-compose.yaml`):
```
MONGO_ROOT_USER=root
MONGO_ROOT_PASSWORD=password
MONGODB_URI=mongodb://root:password@mongo:27017/fireaid?authSource=admin
OPENROUTER_API_KEY=<your-openrouter-api-key>
```

### Getting an OpenRouter API Key
1. Go to https://openrouter.ai
2. Sign up for a free account
3. Go to "Keys" → "Create Key"
4. Copy the key (starts with `sk-or-v1-...`)
5. Paste it into `.env` as `OPENROUTER_API_KEY`

> ⚠️ Without this key, the following features will show "401 Missing Authentication header":
> - FireAID Assistant (Chat page)
> - Ask AI on the Fire History page
> - The Alaska Fire Risk chat

---

## 📚 Required: Terminology Data (for Library page)

The Library page (`/library`) reads from the MongoDB `terms` collection.

**Data format:**
```json
{ "term": "Prescribed Fire", "def": "A fire intentionally ignited to meet specific land management objectives." }
```

**To import terms into MongoDB, run:**
```bash
docker exec -it firemcp python3 -c "
from pymongo import MongoClient
client = MongoClient('mongodb://root:password@mongo:27017/fireaid?authSource=admin')
db = client['fireaid']
terms = [
    # Add your terms here as dicts with 'term' and 'def' keys
    # Example:
    # {'term': 'Prescribed Fire', 'def': 'A fire intentionally ignited...'},
]
if terms:
    db['terms'].insert_many(terms)
    print(f'Inserted {len(terms)} terms')
else:
    print('No terms to insert')
"
```

Or if you have a JSON file of terms:
```bash
docker exec -it mongo mongoimport \
  --uri 'mongodb://root:password@localhost:27017/fireaid?authSource=admin' \
  --collection terms \
  --file /path/to/terms.json \
  --jsonArray
```

---

## 🚀 Pages Overview

| Page | Path | AI Required | Description |
|------|------|-------------|-------------|
| Chat | `/portal` | ✅ Yes | FireAID Assistant over fire records, literature and terms |
| Fire History | `/mcp-tools` | ✅ Yes | Fire records map, query builder and Ask AI with charts |
| Alaska Fire Risk | `/fire-risk` | ✅ Yes | Fire danger forecast, map, risk classifier and chat |
| Forest Trends | `/forest-trends` | No | Vegetation trend maps and point time series, from Sumana Sahoo's Forest Trend Mapper (needs Earth Engine) |
| Burn Severity Recovery | `/burn-recovery` | No | Saved three-fire burn severity study, served by FireMCP |
| Publication | `/publication` | No | Semantic search of research abstracts (needs rag-service) |
| Library | `/library` | No | Wildfire terminology dictionary |

---

## 🐳 Starting the App
```bash
docker-compose up -d
```

Then open http://localhost:3000

---

## 🗂️ Key Files
```
fireaid_web/src/app/
├── api/
│   ├── mcp/
│   │   ├── run/route.ts        # MCP query endpoint
│   │   └── analyze/route.ts    # Fire History Ask AI (answers and charts)
│   ├── burn-recovery/route.ts  # Burn Severity Recovery, via FireMCP
│   ├── models/route.ts         # Which model each AI chat uses
│   └── terms/route.ts          # Terminology CRUD
├── portal/page.tsx             # FireAID Assistant (Chat)
├── mcp-tools/page.tsx          # Fire History
├── fire-risk/page.tsx          # Alaska Fire Risk
├── forest-trends/page.tsx      # Forest Trends
├── burn-recovery/page.tsx      # Burn Severity Recovery
├── publication/page.tsx        # Publication
└── library/page.tsx            # Terminology Library
```