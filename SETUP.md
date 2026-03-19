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
> - AI Query (MCP Tools page)
> - AI Chart Generator (Charts page)
> - AI Fire Prediction (Prediction page)
> - AI Report Generator (Reports page)

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
| Search | `/search` | No | Search fire records with filters |
| Charts | `/charts` | ✅ Yes | AI-generated charts from natural language |
| Prediction | `/prediction` | ✅ Yes | AI fire trend prediction |
| Reports | `/reports` | ✅ Yes | AI-generated PDF reports |
| Library | `/library` | No | Wildfire terminology dictionary |
| Explore | `/mcp-tools` | ✅ Yes | MCP tools + AI query + map |

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
│   │   ├── chat/route.ts       # AI natural language query
│   │   ├── chart/route.ts      # AI chart generation
│   │   ├── predict/route.ts    # AI fire prediction
│   │   └── report/route.ts     # AI report generation
│   └── terms/route.ts          # Terminology CRUD
├── search/page.tsx             # Search page
├── charts/page.tsx             # AI Charts page
├── prediction/page.tsx         # AI Prediction page
├── reports/page.tsx            # AI Reports page
├── library/page.tsx            # Terminology Library
└── mcp-tools/page.tsx          # MCP Explorer
```