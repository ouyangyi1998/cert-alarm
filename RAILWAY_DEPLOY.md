# Railway 部署指南

## 🚀 快速部署到 Railway

### 1. 访问 Railway
- 打开 [Railway.app](https://railway.app/)
- 点击 "Login" 使用 GitHub 账户登录

### 2. 创建新项目
- 点击 "New Project"
- 选择 "Deploy from GitHub repo"
- 搜索并选择 `ouyangyi1998/cert-alarm`

### 3. 自动部署
- Railway 会自动检测 Node.js 项目
- 自动安装依赖并启动服务
- 等待部署完成（通常2-3分钟）

### 4. 获取访问地址
- 部署完成后，Railway 会提供一个 URL
- 格式：`https://cert-alarm-production-xxxx.up.railway.app`

### 5. 配置系统
- 访问提供的 URL
- 系统会自动初始化数据库
- 进入 Web 管理界面进行配置

## 🔧 配置说明

### 环境变量（可选）
Railway 会自动设置以下环境变量：
- `PORT`: 自动分配
- `NODE_ENV`: production
- `RAILWAY_STATIC_URL`: 静态资源URL

### 数据库
- 使用 SQLite 数据库
- 数据自动持久化
- 无需额外配置

### 域名
- Railway 提供免费子域名
- 自动 HTTPS 证书
- 可绑定自定义域名

## 📊 监控和维护

### 查看日志
- 在 Railway 控制台查看实时日志
- 监控服务状态和性能

### 更新部署
- 推送代码到 GitHub
- Railway 会自动重新部署

### 备份数据
- 定期备份 SQLite 数据库
- 导出配置信息

## 💰 费用说明

### 免费额度
- **500小时/月**: 足够24/7运行
- **512MB RAM**: 满足基本需求
- **1GB 存储**: 数据库和文件存储

### 升级选项
- **Hobby Plan**: $5/月
- **Pro Plan**: $20/月
- **Team Plan**: $99/月

## 🎯 部署检查清单

- ✅ GitHub 仓库已更新
- ✅ Railway 账户已注册
- ✅ 项目已连接
- ✅ 部署成功完成
- ✅ 可以正常访问
- ✅ 功能测试通过

## 🚨 常见问题

### 部署失败
- 检查构建日志
- 确认依赖安装成功
- 检查端口配置

### 服务无法启动
- 检查启动日志
- 确认环境变量设置
- 检查数据库初始化

### 访问问题
- 确认服务已启动
- 检查域名配置
- 查看网络连接

## 📞 技术支持

如果遇到问题，可以：
1. 查看 Railway 文档
2. 检查项目日志
3. 联系技术支持
