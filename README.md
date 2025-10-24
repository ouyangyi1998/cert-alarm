# SSL证书监控系统

一个基于Node.js的SSL证书监控系统，用于监控网站SSL证书的到期时间，并在证书即将到期时发送邮件通知。

## 功能特性

- 🔍 **自动证书检查**: 定期检查配置的域名SSL证书状态
- 📧 **邮件通知**: 证书即将到期时自动发送邮件通知
- ⏰ **定时任务**: 支持自定义检查频率和时区设置
- 🌐 **Web界面**: 提供友好的Web管理界面
- 💾 **数据库存储**: 使用SQLite数据库存储所有配置和数据
- 🔒 **Cloudflare支持**: 支持Cloudflare代理域名的证书检查
- 📊 **状态监控**: 实时显示证书状态和检查结果

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite3
- **前端**: HTML + CSS + JavaScript + Bootstrap
- **定时任务**: node-cron
- **邮件服务**: nodemailer
- **证书检查**: Node.js TLS模块

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/ouyangyi1998/cert-alarm.git
cd cert-alarm
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

### 4. 访问系统

打开浏览器访问: http://localhost:3000

## 配置说明

### 数据库初始化

系统启动时会自动初始化SQLite数据库，无需手动配置。数据库文件将保存在 `data/cert-alarm.db`。

### 邮件配置

1. 在Web界面中进入"邮件设置"页面
2. 配置SMTP服务器信息：
   - SMTP服务器地址
   - 端口号
   - 用户名和密码
   - 发送方邮箱
3. 添加接收通知的邮箱地址

### 域名管理

1. 在"域名管理"页面添加需要监控的域名
2. 系统会自动检查域名的SSL证书状态
3. 支持Cloudflare代理的域名

### 定时任务

1. 在"定时任务"页面配置检查频率
2. 支持Cron表达式设置
3. 可设置时区

## API接口

### 系统状态
- `GET /api/status` - 获取系统状态和检查结果

### 证书检查
- `POST /api/check-certificates` - 手动执行证书检查
- `GET /api/certificate/:domain` - 检查单个域名证书

### 配置管理
- `GET /api/config` - 获取系统配置
- `PUT /api/config` - 更新系统配置

### 邮件管理
- `POST /api/emails` - 添加邮箱
- `DELETE /api/emails/:email` - 删除邮箱
- `POST /api/send-test-email` - 发送测试邮件

## 项目结构

```
cert-alarm/
├── src/                    # 源代码目录
│   ├── certChecker.js     # 证书检查模块
│   ├── configManager.js   # 配置管理模块
│   ├── database.js        # 数据库操作模块
│   ├── emailService.js    # 邮件服务模块
│   ├── routes.js          # API路由
│   └── scheduler.js       # 定时任务调度器
├── public/                # 前端静态文件
│   ├── index.html         # 主页面
│   ├── app.js            # 前端JavaScript
│   └── styles.css          # 样式文件
├── data/                 # 数据库文件目录
├── app.js               # 应用入口文件
├── package.json         # 项目配置
└── README.md           # 项目说明
```

## 环境变量

可以通过环境变量配置系统参数：

- `PORT`: 服务端口（默认: 3000）
- `NODE_ENV`: 运行环境（development/production）

## 部署说明

### 生产环境部署

1. 确保服务器已安装Node.js
2. 克隆项目到服务器
3. 安装依赖: `npm install --production`
4. 启动服务: `npm start`
5. 建议使用PM2等进程管理工具

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 注意事项

1. **数据库**: 系统使用SQLite数据库，数据文件保存在 `data/` 目录下
2. **邮件配置**: 确保SMTP服务器配置正确，建议使用企业邮箱
3. **防火墙**: 确保服务器可以访问外网进行证书检查
4. **权限**: 确保应用有读写数据库文件的权限

## 故障排除

### 常见问题

1. **数据库连接失败**: 检查 `data/` 目录权限
2. **邮件发送失败**: 检查SMTP配置和网络连接
3. **证书检查失败**: 检查域名是否正确，网络是否通畅

### 日志查看

系统运行日志会输出到控制台，生产环境建议重定向到日志文件。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始版本发布
- 支持SSL证书监控
- 支持邮件通知
- 支持Web管理界面
- 支持SQLite数据库存储
