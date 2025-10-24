#!/bin/bash

# SSL证书监控系统启动脚本

echo "正在启动SSL证书监控系统..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js，请先安装Node.js"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到npm，请先安装npm"
    exit 1
fi

# 检查环境变量文件是否存在
if [ ! -f .env ]; then
    echo "警告: 未找到.env文件，正在从模板创建..."
    cp env.example .env
    echo "请编辑.env文件配置邮件设置，然后重新运行此脚本"
    exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

# 创建必要的目录
mkdir -p config logs

# 启动应用
echo "启动SSL证书监控系统..."
echo "访问地址: http://localhost:3000"
echo "按 Ctrl+C 停止服务"

npm start
