#!/bin/bash
set -e

echo "Starting post-create setup..."

# Create .env file if .env.template exists
if [ -f .env.template ]; then
  echo "Copying .env.template to .env"
  cp .env.template .env
else
  echo "Creating default .env file"
  cat > .env << EOL
# Next.js environment variables
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# OpenAI (for @ai-sdk/openai)
OPENAI_API_KEY=your_openai_api_key_here

# App settings
NODE_ENV=development
EOL
fi

# Install dependencies
echo "Installing dependencies"
npm ci || { echo "npm ci failed, trying npm install"; npm install; }

echo "Environment setup complete!" 