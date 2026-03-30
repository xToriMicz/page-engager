#!/bin/bash
# Page Engager — Quick Setup (Mac/Linux)
set -e

echo "=== Page Engager Setup ==="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Node.js not found. Install from https://nodejs.org/ (v18+)"
  exit 1
fi
echo "Node.js: $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Install Playwright
echo ""
echo "Installing Chromium browser..."
npx playwright install chromium

# Setup .env
if [ ! -f .env ]; then
  echo ""
  echo "Creating .env file..."
  cp .env.example .env
  echo ""
  echo "IMPORTANT: Edit .env and set your ANTHROPIC_API_KEY"
  echo "  Get key from: https://console.anthropic.com/"
  echo ""
  read -p "Enter your Anthropic API key (or press Enter to skip): " api_key
  if [ -n "$api_key" ]; then
    sed -i.bak "s/sk-ant-your-key-here/$api_key/" .env && rm -f .env.bak
    echo "API key saved to .env"
  fi
fi

# Setup database
echo ""
echo "Setting up database..."
npx drizzle-kit push

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start: npm run dev"
echo "Then open: http://localhost:5173"
echo ""
echo "First time? Go to Settings → select Chrome Profile → select your Page"
