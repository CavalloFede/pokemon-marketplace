#!/bin/bash
# ngrok tunnel script for Pokemon Marketplace

echo "=================================="
echo "Pokemon Marketplace - ngrok Tunnel"
echo "=================================="

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "Error: ngrok is not installed."
    echo ""
    echo "Install ngrok:"
    echo "  - macOS: brew install ngrok/ngrok/ngrok"
    echo "  - Linux: https://ngrok.com/download"
    echo "  - Or visit: https://ngrok.com/download"
    exit 1
fi

# Check if ngrok is authenticated
if ! ngrok config check 2>/dev/null | grep -q "authtoken"; then
    echo "Warning: ngrok may not be authenticated."
    echo "Run: ngrok config add-authtoken YOUR_TOKEN"
    echo ""
fi

# Parse arguments
PORT=3000
SERVICE="api"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --api) PORT=3000; SERVICE="API" ;;
        --web) PORT=5173; SERVICE="Web" ;;
        --both)
            echo "Starting tunnels for both API and Web..."
            echo ""

            # Check if ngrok config supports multiple tunnels
            if command -v gnome-terminal &> /dev/null; then
                gnome-terminal -- bash -c "ngrok http 3000; exec bash"
                gnome-terminal -- bash -c "ngrok http 5173; exec bash"
            elif command -v osascript &> /dev/null; then
                osascript -e 'tell app "Terminal" to do script "ngrok http 3000"'
                osascript -e 'tell app "Terminal" to do script "ngrok http 5173"'
            else
                echo "Please open two terminals and run:"
                echo "  Terminal 1: ngrok http 3000"
                echo "  Terminal 2: ngrok http 5173"
            fi
            exit 0
            ;;
        --port)
            shift
            PORT=$1
            SERVICE="Custom"
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --api      Expose API (port 3000) - Default"
            echo "  --web      Expose Web (port 5173)"
            echo "  --both     Expose both API and Web (opens two terminals)"
            echo "  --port N   Expose custom port N"
            echo "  --help     Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Check if the service is running
if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "Warning: No service detected on port $PORT"
    echo "Make sure your $SERVICE server is running first."
    echo ""
fi

echo "Starting ngrok tunnel for $SERVICE (port $PORT)..."
echo ""
echo "Once started, you'll see a public URL like:"
echo "  https://abc123.ngrok.io"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

ngrok http $PORT
