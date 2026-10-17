#!/usr/bin/env bash
# 本地预览：启动 Express 后端（server.js），同时 serve public/ 和 /api/*。
# 必须走 http：直接双击 public/index.html 的话，file:// 协议下字体会被
# CORS 拦掉，API 也没法用。
#   ./serve.sh          默认 8080
#   ./serve.sh 3000     换端口
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
PORT="${1:-${PORT:-8080}}" exec node server.js
