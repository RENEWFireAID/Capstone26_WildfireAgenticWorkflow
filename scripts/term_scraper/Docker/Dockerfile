FROM python:3.15.0a6-slim-trixie

WORKDIR /term_scraper

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY term_scraper.py .
CMD ["python3", "term_scraper.py"]
