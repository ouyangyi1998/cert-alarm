const express = require('express');
const router = express.Router();
const certChecker = require('./certChecker');
const emailService = require('./emailService');
const configManager = require('./configManager');
const scheduler = require('./scheduler');

/**
 * 获取系统状态
 */
router.get('/status', async (req, res) => {
    try {
        const config = await configManager.getConfig();
        const schedulerStatus = await scheduler.getStatus();
        
        // 获取最新的检查结果
        let checkResults = null;
        try {
            const lastCheck = await scheduler.getLastCheckResults();
            if (lastCheck) {
                checkResults = lastCheck;
            }
        } catch (error) {
            console.log('获取检查结果失败:', error.message);
        }
        
        res.json({
            success: true,
            data: {
                config: {
                    domains: config.domains,
                    emailSettings: config.emailSettings,
                    scheduleSettings: config.scheduleSettings
                },
                scheduler: schedulerStatus,
                checkResults: checkResults
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取系统状态失败',
            error: error.message
        });
    }
});

/**
 * 手动检查证书
 */
router.post('/check-certificates', async (req, res) => {
    try {
        const result = await scheduler.manualCheck();
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '证书检查失败',
            error: error.message
        });
    }
});

/**
 * 发送测试邮件
 */
router.post('/send-test-email', async (req, res) => {
    try {
        const config = await configManager.getConfig();
        const toEmails = config.emailSettings.toEmails;
        
        if (!toEmails || toEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: '未配置接收邮箱'
            });
        }
        
        const result = await emailService.sendTestEmail(toEmails);
        
        if (result) {
            res.json({
                success: true,
                message: '测试邮件发送成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '测试邮件发送失败'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '发送测试邮件失败',
            error: error.message
        });
    }
});

/**
 * 更新配置
 */
router.put('/config', async (req, res) => {
    try {
        const { domains, emailSettings, scheduleSettings } = req.body;
        
        // 验证输入
        if (domains && !Array.isArray(domains)) {
            return res.status(400).json({
                success: false,
                message: '域名配置必须是数组格式'
            });
        }
        
        if (emailSettings && emailSettings.toEmails) {
            if (!Array.isArray(emailSettings.toEmails)) {
                return res.status(400).json({
                    success: false,
                    message: '邮箱配置必须是数组格式'
                });
            }
            
            // 验证每个邮箱格式
            for (const email of emailSettings.toEmails) {
                if (email && !email.includes('@')) {
                    return res.status(400).json({
                        success: false,
                        message: `邮箱地址格式不正确: ${email}`
                    });
                }
            }
        }
        
        // 更新配置
        const updated = await configManager.updateConfig({
            domains,
            emailSettings,
            scheduleSettings
        });
        
        if (updated) {
            // 重新启动定时任务
            await scheduler.startScheduledTask();
            
            res.json({
                success: true,
                message: '配置更新成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '配置更新失败'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '更新配置失败',
            error: error.message
        });
    }
});

/**
 * 获取证书详情
 */
router.get('/certificate/:domain', async (req, res) => {
    try {
        const { domain } = req.params;
        const result = await certChecker.checkCertificate(domain);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取证书信息失败',
            error: error.message
        });
    }
});

/**
 * 验证邮件配置
 */
router.post('/verify-email-config', async (req, res) => {
    try {
        const result = await emailService.verifyConnection();
        
        res.json({
            success: true,
            data: {
                isValid: result
            },
            message: result ? '邮件配置验证成功' : '邮件配置验证失败'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '验证邮件配置失败',
            error: error.message
        });
    }
});

/**
 * 添加邮箱
 */
router.post('/emails', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                message: '邮箱地址格式不正确'
            });
        }
        
        await configManager.addEmail(email);
        
        res.json({
            success: true,
            message: '邮箱添加成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '添加邮箱失败',
            error: error.message
        });
    }
});

/**
 * 删除邮箱
 */
router.delete('/emails/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        await configManager.removeEmail(email);
        
        res.json({
            success: true,
            message: '邮箱删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除邮箱失败',
            error: error.message
        });
    }
});

/**
 * 获取所有邮箱
 */
router.get('/emails', async (req, res) => {
    try {
        const emails = configManager.getEmails();
        
        res.json({
            success: true,
            data: emails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取邮箱列表失败',
            error: error.message
        });
    }
});

/**
 * 执行日报任务
 */
router.post('/daily-report', async (req, res) => {
    try {
        await scheduler.executeDailyReport();
        res.json({ success: true, message: '日报任务执行成功' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '执行日报任务失败',
            error: error.message
        });
    }
});

module.exports = router;
