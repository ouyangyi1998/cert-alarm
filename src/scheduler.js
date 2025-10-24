const cron = require('node-cron');
const moment = require('moment');

const certChecker = require('./certChecker');
const emailService = require('./emailService');
const configManager = require('./configManager');

/**
 * 定时任务调度器类
 */
class Scheduler {
    constructor() {
        this.currentTask = null;
        this.isRunning = false;
        this.lastCheckResults = null;
    }

    /**
     * 初始化调度器
     */
    async initialize() {
        console.log('正在初始化定时任务调度器...');
        
        // 初始化配置管理器
        await configManager.initialize();
        
        // 启动定时任务
        await this.startScheduledTask();
        
        console.log('定时任务调度器初始化完成');
    }

    /**
     * 启动定时任务
     */
    async startScheduledTask() {
        const scheduleSettings = await configManager.getScheduleSettings();
        
        if (!scheduleSettings.enabled) {
            console.log('定时任务已禁用');
            return;
        }

        // 确保只有一个定时任务运行
        if (this.currentTask) {
            console.log('停止现有定时任务');
            this.stopScheduledTask();
        }

        try {
            // 验证cron表达式
            if (!cron.validate(scheduleSettings.cronExpression)) {
                console.error('无效的cron表达式:', scheduleSettings.cronExpression);
                return;
            }

            // 创建新的定时任务
            this.currentTask = cron.schedule(
                scheduleSettings.cronExpression,
                async () => {
                    // 先执行证书检查
                    await this.executeCertificateCheck();
                    // 然后执行日报任务
                    await this.executeDailyReport();
                },
                {
                    scheduled: true,
                    timezone: scheduleSettings.timezone || 'Asia/Shanghai'
                }
            );

            console.log(`定时任务已启动，执行时间: ${scheduleSettings.cronExpression}`);
            console.log(`时区设置: ${scheduleSettings.timezone || 'Asia/Shanghai'}`);

        } catch (error) {
            console.error('启动定时任务失败:', error);
        }
    }

    /**
     * 停止定时任务
     */
    stopScheduledTask() {
        if (this.currentTask) {
            if (typeof this.currentTask.destroy === 'function') {
                this.currentTask.destroy();
            }
            this.currentTask = null;
            console.log('定时任务已停止');
        }
    }

    /**
     * 执行证书检查任务
     */
    async executeCertificateCheck() {
        if (this.isRunning) {
            console.log('证书检查任务正在运行中，跳过本次执行');
            return;
        }

        this.isRunning = true;
        const startTime = moment().format('YYYY-MM-DD HH:mm:ss');
        
        console.log(`开始执行证书检查任务 - ${startTime}`);

        try {
            const config = await configManager.getConfig();
            const domains = config.domains;
            const emailSettings = config.emailSettings;
            const warningDays = emailSettings.warningDays || 30;

            if (!domains || domains.length === 0) {
                console.log('没有配置监控域名，跳过检查');
                return;
            }

            if (!emailSettings.toEmails || emailSettings.toEmails.length === 0) {
                console.log('没有配置接收邮箱，跳过邮件发送');
                return;
            }

            // 检查所有域名的证书
            console.log(`开始检查 ${domains.length} 个域名的证书状态...`);
            const results = await certChecker.checkMultipleCertificates(domains);

            // 分析结果
            const healthyCerts = [];
            const expiringCerts = [];
            const failedCerts = [];

            results.forEach(result => {
                if (result.status === 'success') {
                    if (certChecker.isCertificateExpiring(result, warningDays)) {
                        expiringCerts.push(result);
                    } else {
                        healthyCerts.push(result);
                    }
                } else {
                    failedCerts.push(result);
                }
            });

            // 记录检查结果
            console.log(`检查完成 - 正常: ${healthyCerts.length}, 即将到期: ${expiringCerts.length}, 失败: ${failedCerts.length}`);

            // 发送邮件通知
            if (expiringCerts.length > 0) {
                console.log(`发现 ${expiringCerts.length} 个即将到期的证书，发送提醒邮件...`);
                
                const emailSent = await emailService.sendCertificateAlert(
                    expiringCerts,
                    emailSettings.toEmails,
                    warningDays
                );

                if (emailSent) {
                    await configManager.updateLastEmailSent(moment().format('YYYY-MM-DD HH:mm:ss'));
                    console.log('证书到期提醒邮件发送成功');
                } else {
                    console.log('证书到期提醒邮件发送失败');
                }
            } else {
                console.log('没有即将到期的证书，无需发送提醒邮件');
            }

            // 更新最后检查时间
            await configManager.updateLastCheckTime(startTime);

            // 记录详细结果
            this.logCheckResults(results, expiringCerts, failedCerts);

        } catch (error) {
            console.error('执行证书检查任务时发生错误:', error);
        } finally {
            this.isRunning = false;
            const endTime = moment().format('YYYY-MM-DD HH:mm:ss');
            console.log(`证书检查任务完成 - ${endTime}`);
        }
    }

    /**
     * 记录检查结果
     * @param {Array} allResults - 所有检查结果
     * @param {Array} expiringCerts - 即将到期的证书
     * @param {Array} failedCerts - 检查失败的证书
     */
    logCheckResults(allResults, expiringCerts, failedCerts) {
        console.log('\n=== 证书检查结果详情 ===');
        
        // 记录即将到期的证书
        if (expiringCerts.length > 0) {
            console.log('\n⚠️  即将到期的证书:');
            expiringCerts.forEach(cert => {
                console.log(`   ${cert.domain} - 剩余 ${cert.daysUntilExpiry} 天 (${cert.expiryDate})`);
            });
        }

        // 记录检查失败的证书
        if (failedCerts.length > 0) {
            console.log('\n❌ 检查失败的域名:');
            failedCerts.forEach(cert => {
                console.log(`   ${cert.domain} - ${cert.error}`);
            });
        }

        // 记录正常的证书
        const healthyCerts = allResults.filter(r => r.status === 'success' && !certChecker.isCertificateExpiring(r));
        if (healthyCerts.length > 0) {
            console.log('\n✅ 正常的证书:');
            healthyCerts.forEach(cert => {
                console.log(`   ${cert.domain} - 剩余 ${cert.daysUntilExpiry} 天`);
            });
        }

        console.log('\n=== 检查结果详情结束 ===\n');
    }

    /**
     * 手动执行一次证书检查
     * @returns {Promise<Object>} 检查结果
     */
    async manualCheck() {
        console.log('手动执行证书检查...');
        
        const config = await configManager.getConfig();
        const domains = config.domains;

        if (!domains || domains.length === 0) {
            throw new Error('没有配置监控域名');
        }

        const results = await certChecker.checkMultipleCertificates(domains);
        
        // 分析结果
        const healthyCerts = [];
        const expiringCerts = [];
        const failedCerts = [];
        const warningDays = config.emailSettings.warningDays || 30;

        results.forEach(result => {
            if (result.status === 'success') {
                if (certChecker.isCertificateExpiring(result, warningDays)) {
                    expiringCerts.push(result);
                } else {
                    healthyCerts.push(result);
                }
            } else {
                failedCerts.push(result);
            }
        });

        const checkResults = {
            total: results.length,
            healthy: healthyCerts.length,
            expiring: expiringCerts.length,
            failed: failedCerts.length,
            results: results,
            expiringCerts: expiringCerts,
            failedCerts: failedCerts,
            lastCheckTime: new Date().toLocaleString()
        };
        
        // 缓存检查结果
        this.lastCheckResults = checkResults;
        
        return checkResults;
    }

    /**
     * 获取调度器状态
     * @returns {Object} 调度器状态
     */
    async getStatus() {
        const scheduleSettings = await configManager.getScheduleSettings();
        
        return {
            isRunning: this.isRunning,
            taskActive: this.currentTask !== null,
            scheduleEnabled: scheduleSettings.enabled,
            cronExpression: scheduleSettings.cronExpression,
            timezone: scheduleSettings.timezone || 'Asia/Shanghai',
            lastCheckTime: await configManager.getLastCheckTime(),
            lastEmailSent: await configManager.getLastEmailSent()
        };
    }

    /**
     * 获取最后一次检查结果
     * @returns {Object|null} 检查结果
     */
    async getLastCheckResults() {
        try {
            // 返回缓存的检查结果
            if (this.lastCheckResults) {
                return this.lastCheckResults;
            }
            return null;
        } catch (error) {
            console.error('获取最后检查结果失败:', error);
            return null;
        }
    }

    /**
     * 执行日报任务
     */
    async executeDailyReport() {
        console.log('执行日报任务...');
        
        const config = await configManager.getConfig();
        const dailyReportSettings = config.dailyReportSettings;
        
        // 检查日报是否启用
        if (!dailyReportSettings || !dailyReportSettings.enabled) {
            console.log('日报功能未启用');
            return;
        }
        
        // 检查是否有配置的邮箱
        if (!config.emailSettings.toEmails || config.emailSettings.toEmails.length === 0) {
            console.log('没有配置接收邮箱，跳过日报发送');
            return;
        }
        
        try {
            // 执行证书检查获取最新数据
            const checkResults = await this.manualCheck();
            
            if (checkResults) {
                // 发送日报邮件
                console.log('发送日报邮件...');
                await emailService.sendDailyReport(config.emailSettings.toEmails, checkResults);
                console.log('日报邮件发送成功');
                
                // 更新最后发送时间
                await configManager.updateConfig({
                    lastEmailSent: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('执行日报任务失败:', error);
        }
    }
}

module.exports = new Scheduler();

