const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const certChecker = require('./src/certChecker');
const emailService = require('./src/emailService');
const configManager = require('./src/configManager');
const scheduler = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// API 路由
app.use('/api', require('./src/routes'));

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`证书监控系统已启动，访问地址: http://localhost:${PORT}`);
    
    // 初始化定时任务
    scheduler.initialize();
});

module.exports = app;

