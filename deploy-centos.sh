#!/bin/bash

echo "🚀 开始部署SSL证书监控系统到CentOS服务器..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "请使用root用户运行此脚本"
    exit 1
fi

# 更新系统
echo "📦 更新系统包..."
yum update -y

# 安装Node.js
echo "📦 安装Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# 安装PM2
echo "📦 安装PM2进程管理器..."
npm install -g pm2

# 安装Nginx
echo "📦 安装Nginx..."
yum install -y epel-release
yum install -y nginx

# 安装Git
echo "📦 安装Git..."
yum install -y git

# 安装firewalld
echo "📦 安装firewalld..."
yum install -y firewalld
systemctl start firewalld
systemctl enable firewalld

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
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=587/tcp  # SMTP TLS
firewall-cmd --permanent --add-port=465/tcp  # SMTP SSL
firewall-cmd --permanent --add-port=25/tcp    # SMTP
firewall-cmd --reload

# 配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/conf.d/cert-alarm.conf << 'EOF'
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

# 启动Nginx
systemctl start nginx
systemctl enable nginx

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
echo "3. 配置邮件设置（SMTP端口已开放）"
echo "4. 设置定时任务"
echo ""
echo "📧 SMTP端口说明："
echo "- 25端口: 标准SMTP（可能被ISP屏蔽）"
echo "- 587端口: SMTP TLS（推荐）"
echo "- 465端口: SMTP SSL（推荐）"
