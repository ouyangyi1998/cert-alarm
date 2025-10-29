# SSL证书监控系统

一个基于Node.js的SSL证书监控系统，用于监控网站SSL证书的到期时间，并在证书即将到期时发送邮件通知。

## 🎉 版本信息

**当前版本**: v1.2.0  
**发布日期**: 2025年10月29日  
**状态**: 稳定版本

## 功能特性

- 🔍 **自动证书检查**: 定期检查配置的域名SSL证书状态
- 📧 **邮件通知**: 证书即将到期时自动发送邮件通知（告警）
- ⏰ **定时任务（拆分）**: 检查任务与“每日证书监控日报”两套独立 cron 与时区
- 🔁 **日报强制刷新**: 每次发送日报前都会先执行一次全量检查
- 🔄 **当日重发策略**: 默认每天仅发送一次日报；可通过开关显式允许当天修改后重发
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
4. 设置“全局预警天数”（所有收件人共用）

> 说明：预警与日报均使用数据库中的 SMTP 配置，发件人以“发送方邮箱”为准。

### 域名管理

1. 在"域名管理"页面添加需要监控的域名
2. 系统会自动检查域名的SSL证书状态
3. 支持Cloudflare代理的域名

### 定时任务

系统有两套独立的计划任务：

- 证书检查：按“检查时间/时区”执行；若发现到期阈值内的证书，会发送到期告警邮件。
- 每日证书监控日报：按“日报时间/时区”执行；发送前总是先做一次全量检查。

提示：你可以将两者设置为不同时间；互不影响。

## API接口

### 系统状态
- `GET /api/status` - 获取系统状态和检查结果

### 证书检查
- `POST /api/check-certificates` - 手动执行证书检查
- `GET /api/certificate/:domain` - 检查单个域名证书

### 日报
- `POST /api/daily-report` - 手动发送“每日证书监控日报”（发送前会执行一次全量检查）

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

#### 方法一：使用PM2（推荐）

1. **安装PM2**：
   ```bash
   npm install -g pm2
   ```

2. **部署项目**：
   ```bash
   git clone https://github.com/ouyangyi1998/cert-alarm.git
   cd cert-alarm
   npm install --production
   ```

3. **启动服务**：
   ```bash
   # 使用PM2启动
   pm2 start ecosystem.config.js
   
   # 保存PM2配置
   pm2 save
   
   # 设置开机自启
   pm2 startup
   ```

4. **管理服务**：
   ```bash
   pm2 status          # 查看状态
   pm2 logs cert-alarm # 查看日志
   pm2 restart cert-alarm # 重启服务
   pm2 stop cert-alarm    # 停止服务
   ```

#### 方法二：直接运行

1. 确保服务器已安装Node.js
2. 克隆项目到服务器
3. 安装依赖: `npm install --production`
4. 启动服务: `npm start`

本地运行时，本文档中的启动命令会将输出重定向到：

- 标准输出：`/tmp/cert-alarm.out`
- 错误输出：`/tmp/cert-alarm.err`

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
2. **邮件配置**: 确保SMTP服务器配置正确，建议使用企业邮箱；465 端口通常 `secure=true`（SSL/TLS），587/25 端口通常 `secure=false`（STARTTLS）
3. **防火墙**: 确保服务器可以访问外网进行证书检查
4. **权限**: 确保应用有读写数据库文件的权限

## 故障排除

### 常见问题

1. **数据库连接失败**: 检查 `data/` 目录权限
2. **邮件发送失败**:
   - 错误 `EAUTH 535`：用户名/密码/发件人不匹配或未开通 SMTP；在“邮件设置”中验证连接
   - 端口与 `secure` 不匹配
   - 网络无法连接 SMTP 服务器
3. **证书检查失败**: 检查域名是否正确，网络是否通畅

4. **日报未发送**:
   - 同一天仅发送一次；若希望当日再次发送，修改“日报时间/设置”后会在新时间重新发送
   - 也可使用“测试日报”按钮立即发送

### 日志查看

系统运行日志会输出到控制台，生产环境建议重定向到日志文件。

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 许可证

MIT License

## 更新日志
### v1.2.0 (2025-10-29)
- ✅ 仅在定时检查/日报时间变更时才重建任务；保存其它配置不再重启
- ✅ 当日重发默认关闭；支持通过 allowSameDayResend 开关显式开启
- ✅ 统一“剩余天数”算法（向上取整，最小 0），预警/日报一致
- ✅ 日志与配置审计增强，便于定位来源

### v1.1.0 (2025-10-27)
- ✨ 拆分“证书检查”和“每日证书监控日报”为独立 cron，互不影响
- ✉️ 统一预警与日报的 SMTP 加载与发件人来源（数据库配置）
- 🔁 日报发送前总是先执行一次全量检查
- 🔄 当日修改日报设置后，当天允许在新时间再次发送
- 🖥️ 前端：邮件设置区分“全局预警天数”和“新增邮箱”，布局优化


### v1.0.0 (2025-10-24) 🎉
- ✅ **初始版本发布**
- ✅ **SSL证书监控**: 支持多域名证书状态检查
- ✅ **邮件通知**: 支持SMTP邮件发送和预警通知
- ✅ **Web管理界面**: 完整的Bootstrap响应式界面
- ✅ **数据库存储**: SQLite数据库持久化存储
- ✅ **定时任务**: 支持自定义检查频率和时区
- ✅ **Cloudflare支持**: 支持Cloudflare代理域名检查
- ✅ **日报功能**: 支持每日证书监控报告
- ✅ **API接口**: 完整的RESTful API
- ✅ **安全配置**: 敏感信息通过Web界面管理
