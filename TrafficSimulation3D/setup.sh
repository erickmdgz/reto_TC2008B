#!/bin/bash

# Setup script for Traffic 3D Simulation with .venv
# For macOS

set -e  # Exit on error

echo "======================================="
echo "Traffic 3D Simulation - Setup"
echo "======================================="
echo ""

# Check if Python 3.11 is installed
if ! command -v python3.11 &> /dev/null
then
    echo "Error: Python 3.11 is not installed"
    echo "Install it with: brew install python@3.11"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "Error: Node.js is not installed"
    echo "Install it with: brew install node"
    exit 1
fi

echo "Python 3.11 found: $(python3.11 --version)"
echo "Node.js found: $(node --version)"
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment..."
    python3.11 -m venv .venv
    echo "Virtual environment created"
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Python dependencies installed"
echo ""

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
cd visualization
npm install
cd ..

echo "Node.js dependencies installed"
echo ""

echo "======================================="
echo "Setup Complete!"
echo "======================================="
echo ""
echo "To run the simulation:"
echo "  ./start.sh"
echo ""
echo "Or manually:"
echo "  Terminal 1: ./start_server.sh"
echo "  Terminal 2: ./start_visualization.sh"
echo ""
