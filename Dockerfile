# Stage 1: Build Tailwind CSS
FROM node:22-slim AS css-builder
WORKDIR /build

# Copy package configurations and build assets
COPY package.json tailwind.config.js ./
COPY app/static/css/src/main.css ./app/static/css/src/main.css
COPY app/templates ./app/templates
COPY app/static/js ./app/static/js

# Install dependencies and build stylesheet
RUN npm install
RUN npm run build:css

# Stage 2: Final Python Image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

WORKDIR /app

# Install system dependencies (build-essential needed for some python dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python codebase
COPY config.py run.py ./
COPY app/ ./app/

# Copy the compiled CSS from the builder stage
COPY --from=css-builder /build/app/static/css/style.css ./app/static/css/style.css

# Expose port
EXPOSE 5001

# Run with Gunicorn using eventlet worker class
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:5001", "run:app"]
