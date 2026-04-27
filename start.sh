#!/bin/bash
# AI Workspace 启动脚本
# 同时启动后端和前端服务

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "=========================================="
echo "  AI Workspace - 智能工作助手"
echo "=========================================="
echo ""

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 Python3，请先安装 Python 3.8+"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi

# 安装后端依赖
echo "📦 检查后端依赖..."
cd "$BACKEND_DIR"
pip install -r requirements.txt --break-system-packages -q 2>/dev/null
echo "✅ 后端依赖已就绪"

# 安装前端依赖
echo "📦 检查前端依赖..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
echo "✅ 前端依赖已就绪"

echo ""
echo "🚀 启动服务..."
echo ""

# 启动后端
cd "$BACKEND_DIR"
echo "🔧 启动后端服务 (http://localhost:8000)..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 启动前端
cd "$FRONTEND_DIR"
echo "🎨 启动前端服务 (http://localhost:3000)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "  ✅ 服务已启动！"
echo "  📱 前端地址: http://localhost:3000"
echo "  🔧 后端地址: http://localhost:8000"
echo "  📖 API文档: http://localhost:8000/docs"
echo "=========================================="
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ 服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 等待
wait
