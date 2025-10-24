#!/bin/bash

echo "🚀 开始部署SSL证书监控系统到本地服务器..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "请使用root用户运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 安装Node.js
echo "📦 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 安装PM2
echo "📦 安装PM2进程管理器..."
npm install -g pm2

# 安装Nginx
echo "📦 安装Nginx..."
apt install nginx -y

# 创建项目目录
echo "📁 创建项目目录..."
mkdir -p /opt/cert-alarm
cd /opt/cert-alarm

# 克隆项目
echo "📥 克隆项目..."
git clone https://github.com/ouyangyi1998/cert-alarm.git .

# 安装依赖
echo "📦 安装项目依赖..."
npm install --production

# 创建日志目录
mkdir -p logs

# 配置环境变量
echo "⚙️ 配置环境变量..."
cp env.example .env

# 启动服务
echo "🚀 启动服务..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 3000
ufw allow 80
ufw allow 443

# 配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/cert-alarm << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/cert-alarm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重启Nginx
nginx -t && systemctl restart nginx

echo "✅ 部署完成！"
echo "🌐 访问地址: http://your-server-ip"
echo "📊 查看状态: pm2 status"
echo "📝 查看日志: pm2 logs cert-alarm"
echo ""
echo "🔧 后续配置："
echo "1. 访问Web界面进行初始配置"
echo "2. 添加要监控的域名"
echo "3. 配置邮件设置"
echo "4. 设置定时任务"
