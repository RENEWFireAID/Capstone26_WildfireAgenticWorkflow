import time
from tools.mongo_fire_tools import search_fire_points, count_by_year

def main():
    print("🔥 FireMCP container starting...")
    print("Smoke test query:")

    results = search_fire_points(year=2024, prescribed="Y", limit=3)
    for r in results:
        print(r)

    print("Count:", count_by_year(2024))

    # Keep container alive (so other services can call it later)
    print("✅ FireMCP is running (idle)...")
    while True:
        time.sleep(3600)

if __name__ == "__main__":
    main()
