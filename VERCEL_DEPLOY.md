# Vercel 部署指南

## 🚀 快速部署到 Vercel

### 1. 访问 Vercel
- 打开 [Vercel.com](https://vercel.com/)
- 点击 "Sign Up" 使用 GitHub 账户注册

### 2. 创建新项目
- 点击 "New Project"
- 选择 "Import Git Repository"
- 搜索并选择 `ouyangyi1998/cert-alarm`

### 3. 配置项目
- **Framework Preset**: Other
- **Root Directory**: (留空)
- **Build Command**: npm install
- **Output Directory**: (留空)
- **Install Command**: npm install

### 4. 环境变量
在 "Environment Variables" 部分添加：
```
NODE_ENV = production
PORT = 3000
```

### 5. 部署
- 点击 "Deploy"
- 等待部署完成（通常2-3分钟）

### 6. 获取访问地址
- 部署完成后，Vercel 会提供一个 URL
- 格式：`https://cert-alarm-xxxx.vercel.app`

## 🔧 配置说明

### 自动配置
Vercel 会自动：
- 检测 Node.js 项目
- 安装依赖
- 启动应用
- 配置 HTTPS
- 分配域名

### 环境变量
Vercel 自动设置：
- `NODE_ENV`: production
- `PORT`: 自动分配
- `VERCEL_URL`: 部署URL

### 数据库
- 使用 SQLite 数据库
- 数据自动持久化
- 无需额外配置

## 📊 监控和维护

### 查看日志
- 在 Vercel 控制台查看实时日志
- 监控服务状态和性能

### 更新部署
- 推送代码到 GitHub
- Vercel 会自动重新部署

### 备份数据
- 定期备份 SQLite 数据库
- 导出配置信息

## 💰 费用说明

### 免费额度
- **100GB 带宽/月**: 足够大部分使用
- **无限部署**: 无部署次数限制
- **全球 CDN**: 快速访问
- **自动 HTTPS**: 免费SSL证书

### 升级选项
- **Pro Plan**: $20/月
- **Enterprise Plan**: 联系销售

## 🎯 部署检查清单

- ✅ GitHub 仓库已更新
- ✅ Vercel 账户已注册
- ✅ 项目已连接
- ✅ 环境变量已设置
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
1. 查看 Vercel 文档
2. 检查项目日志
3. 联系技术支持
4. 查看 GitHub Issues
