# Create base image with dependencies installed
FROM python:3.10-slim

WORKDIR /var/mcp/

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY term_mcp.py .

CMD [ "fastmcp", "run", "term_mcp.py" ]
