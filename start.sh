#!/bin/bash

echo "🚀 מתקין ומפעיל את One-on-One Manager..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 לא מותקן. אנא התקן מ: https://www.python.org/downloads/"
    exit 1
fi

# Check Node
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js לא מותקן. אנא התקן מ: https://nodejs.org/"
    exit 1
fi

echo "✅ Python ו-Node.js מותקנים"
echo ""

# Setup Backend
echo "📦 מתקין Backend..."
cd backend
python3 -m venv venv
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt -q
echo "✅ Backend מוכן"

# Start Backend in background
echo "🔧 מפעיל Backend..."
./venv/bin/uvicorn main:app --port 8000 &
BACKEND_PID=$!
cd ..

# Setup Frontend
echo "📦 מתקין Frontend..."
cd frontend
npm install --silent
echo "✅ Frontend מוכן"

echo ""
echo "=========================================="
echo "🎉 ההתקנה הושלמה!"
echo ""
echo "🌐 פותח את האפליקציה..."
echo "   Frontend: http://localhost:5173"
echo "   API: http://localhost:8000/docs"
echo ""
echo "לסגירה: לחץ Ctrl+C"
echo "=========================================="
echo ""

# Start Frontend (foreground)
npm run dev

# Cleanup
kill $BACKEND_PID 2>/dev/null






