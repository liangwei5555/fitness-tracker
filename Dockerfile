FROM python:3.12-slim

RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install -r requirements.txt

# Frontend deps (cached separately for faster rebuilds)
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm install

# Copy all source
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Start
CMD cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
