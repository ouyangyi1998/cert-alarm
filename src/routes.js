const express = require('express');
const router = express.Router();
const certChecker = require('./certChecker');
const emailService = require('./emailService');
const configManager = require('./configManager');
const scheduler = require('./scheduler');
const database = require('./database');

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
            // 首先尝试从调度器获取缓存的检查结果
            const lastCheck = await scheduler.getLastCheckResults();
            if (lastCheck) {
                checkResults = lastCheck;
            } else {
                // 如果缓存中没有，从数据库加载最新的检查结果
                const dbResults = await database.getLatestCertChecks();
                if (dbResults && dbResults.length > 0) {
                    // 转换数据库格式为前端需要的格式
                    const results = dbResults.map(row => ({
                        domain: row.domain,
                        status: row.status,
                        issuer: row.issuer,
                        subject: row.subject,
                        validFrom: row.valid_from,
                        validTo: row.valid_to,
                        expiryDate: row.expiry_date,
                        daysUntilExpiry: row.days_until_expiry,
                        fingerprint: row.fingerprint,
                        error: row.error_message,
                        lastCheckTime: new Date(row.check_time).toLocaleString()
                    }));
                    
                    // 分析结果
                    const healthyCerts = results.filter(r => r.status === 'success' && r.daysUntilExpiry > 30);
                    const expiringCerts = results.filter(r => r.status === 'success' && r.daysUntilExpiry <= 30);
                    const failedCerts = results.filter(r => r.status === 'error');
                    
                    checkResults = {
                        total: results.length,
                        healthy: healthyCerts.length,
                        expiring: expiringCerts.length,
                        failed: failedCerts.length,
                        results: results,
                        expiringCerts: expiringCerts,
                        failedCerts: failedCerts,
                        lastCheckTime: dbResults[0] ? new Date(dbResults[0].check_time).toLocaleString() : null
                    };
                }
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
                    scheduleSettings: config.scheduleSettings,
                    smtpConfig: config.smtpConfig,
                    dailyReportSettings: config.dailyReportSettings
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
        const { domains, emailSettings, scheduleSettings, smtpConfig, dailyReportSettings } = req.body;
        console.log('收到配置更新请求:', { domains, emailSettings, scheduleSettings, smtpConfig, dailyReportSettings });
        
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
        
        // 验证SMTP配置
        if (smtpConfig) {
            if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
                return res.status(400).json({
                    success: false,
                    message: 'SMTP配置不完整，请填写所有必填字段'
                });
            }
            
            // 验证端口号
            if (isNaN(smtpConfig.port) || smtpConfig.port < 1 || smtpConfig.port > 65535) {
                return res.status(400).json({
                    success: false,
                    message: 'SMTP端口号必须是1-65535之间的数字'
                });
            }
            
            // 验证邮箱格式
            if (!smtpConfig.from.includes('@')) {
                return res.status(400).json({
                    success: false,
                    message: '发送方邮箱格式不正确'
                });
            }
        }
        
        // 更新配置
        const updated = await configManager.updateConfig({
            domains,
            emailSettings,
            scheduleSettings,
            smtpConfig,
            dailyReportSettings
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
        
        // 保存检查结果到数据库
        await certChecker.saveCheckResult(result);
        
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        // 即使检查失败，也要保存错误结果到数据库
        const errorResult = {
            domain: domain,
            status: 'error',
            error: error.message,
            lastCheckTime: new Date().toLocaleString()
        };
        await certChecker.saveCheckResult(errorResult);
        
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
