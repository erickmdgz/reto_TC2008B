#!/bin/bash

# Start both servers with .venv
# For macOS

set -e

echo "======================================="
echo "Traffic 3D Simulation"
echo "======================================="

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "Error: Virtual environment not found"
    echo "Run ./setup.sh first"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "visualization/node_modules" ]; then
    echo "Error: Node modules not found"
    echo "Run ./setup.sh first"
    exit 1
fi

echo ""
echo "Starting Flask server..."
source .venv/bin/activate
python server.py &
FLASK_PID=$!

echo "Waiting for Flask server to start..."
sleep 3

echo "Starting Vite dev server..."
cd visualization
npm run dev &
VITE_PID=$!
cd ..

echo ""
echo "======================================="
echo "Simulation is running!"
echo "======================================="
echo ""
echo "Flask server PID: $FLASK_PID"
echo "Vite server PID: $VITE_PID"
echo ""
echo "Open your browser at: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "======================================="
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $FLASK_PID $VITE_PID 2>/dev/null
    echo "Servers stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Wait for processes
wait
