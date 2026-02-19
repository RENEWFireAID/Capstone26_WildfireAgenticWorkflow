cd ..

# Build and run docker image/container
docker build -t term-scraper -f ./Docker/Dockerfile .
docker run --name term-scraper term-scraper

# Copy the output back to the local machine
docker cp term-scraper:/term_scraper/terms.csv ./terms.csv
docker container rm -f data-ingest

# Modify copied file permissions
chown $UID ./terms.csv
