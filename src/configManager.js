const fs = require('fs').promises;
const path = require('path');
const database = require('./database');

/**
 * 配置管理类
 */
class ConfigManager {
    constructor() {
        this.defaultConfig = {
            domains: [],
            emailSettings: {
                toEmails: [], // 支持多个邮箱
                warningDays: 30
            },
            scheduleSettings: {
                enabled: true,
                cronExpression: '0 9 * * *', // 每天上午9点执行
                timezone: 'Asia/Shanghai'
            },
            dailyReportSettings: {
                enabled: false,
                time: '08:00',
                timezone: 'Asia/Shanghai'
            },
            lastCheckTime: null,
            lastEmailSent: null
        };
        this.config = null;
    }

    /**
     * 初始化配置管理器
     */
    async initialize() {
        try {
            // 初始化数据库
            await database.initialize();
            
            // 从数据库加载配置
            await this.loadConfigFromDatabase();
            console.log('成功从数据库加载配置');
        } catch (error) {
            console.error('数据库初始化失败:', error.message);
            // 如果数据库失败，创建默认配置到数据库
            try {
                await this.createDefaultConfigInDatabase();
                console.log('已创建默认配置到数据库');
            } catch (dbError) {
                console.error('创建默认配置失败:', dbError.message);
                throw new Error('无法初始化配置管理器');
            }
        }
    }

    /**
     * 在数据库中创建默认配置
     * @returns {Promise<void>}
     */
    async createDefaultConfigInDatabase() {
        try {
            // 保存默认配置到数据库
            await database.setConfig('emailSettings', JSON.stringify(this.defaultConfig.emailSettings));
            await database.setConfig('scheduleSettings', JSON.stringify(this.defaultConfig.scheduleSettings));
            
            // 设置配置
            this.config = this.defaultConfig;
        } catch (error) {
            throw new Error(`创建默认配置到数据库失败: ${error.message}`);
        }
    }

    /**
     * 从数据库加载配置
     * @returns {Promise<Object>} 配置对象
     */
    async loadConfigFromDatabase() {
        try {
            console.log('正在从数据库加载配置...');
            const domains = await database.getDomains();
            console.log('加载的域名:', domains);
            const emails = await database.getEmails();
            console.log('加载的邮箱:', emails);
            
            const emailSettingsData = await database.getConfig('emailSettings');
            let emailSettings;
            try {
                emailSettings = emailSettingsData ? JSON.parse(emailSettingsData) : {
                    toEmails: emails,
                    warningDays: 30
                };
            } catch (error) {
                console.log('解析emailSettings失败，使用默认值:', error.message);
                emailSettings = {
                    toEmails: emails,
                    warningDays: 30
                };
            }
            
            const scheduleSettingsData = await database.getConfig('scheduleSettings');
            let scheduleSettings;
            try {
                scheduleSettings = scheduleSettingsData ? JSON.parse(scheduleSettingsData) : {
                    enabled: true,
                    cronExpression: '0 9 * * *',
                    timezone: 'Asia/Shanghai'
                };
            } catch (error) {
                console.log('解析scheduleSettings失败，使用默认值:', error.message);
                scheduleSettings = {
                    enabled: true,
                    cronExpression: '0 9 * * *',
                    timezone: 'Asia/Shanghai'
                };
            }
            
            // 加载SMTP配置
            const smtpConfigData = await database.getConfig('smtpConfig');
            let smtpConfig = null;
            if (smtpConfigData) {
                try {
                    smtpConfig = JSON.parse(smtpConfigData);
                } catch (error) {
                    console.log('解析smtpConfig失败:', error.message);
                }
            }
            
            // 加载日报设置
            const dailyReportSettingsData = await database.getConfig('dailyReportSettings');
            let dailyReportSettings;
            try {
                dailyReportSettings = dailyReportSettingsData ? JSON.parse(dailyReportSettingsData) : {
                    enabled: false,
                    time: '08:00',
                    timezone: 'Asia/Shanghai'
                };
            } catch (error) {
                console.log('解析dailyReportSettings失败，使用默认值:', error.message);
                dailyReportSettings = {
                    enabled: false,
                    time: '08:00',
                    timezone: 'Asia/Shanghai'
                };
            }
            
            this.config = {
                domains: domains,
                emailSettings: emailSettings,
                scheduleSettings: scheduleSettings,
                smtpConfig: smtpConfig,
                dailyReportSettings: dailyReportSettings,
                lastCheckTime: await database.getConfig('lastCheckTime'),
                lastEmailSent: await database.getConfig('lastEmailSent')
            };
            
            console.log('配置加载完成:', this.config);
            return this.config;
        } catch (error) {
            console.error('从数据库加载配置失败:', error);
            throw new Error(`从数据库加载配置失败: ${error.message}`);
        }
    }


    /**
     * 保存配置文件
     * @param {Object} config - 配置对象
     * @returns {Promise<void>}
     */
    async saveConfig(config) {
        try {
            // 只保存到数据库
            await database.setConfig('emailSettings', JSON.stringify(config.emailSettings));
            await database.setConfig('scheduleSettings', JSON.stringify(config.scheduleSettings));
            
            // 保存SMTP配置
            if (config.smtpConfig) {
                await database.setConfig('smtpConfig', JSON.stringify(config.smtpConfig));
            }
            
            // 保存日报设置
            if (config.dailyReportSettings) {
                await database.setConfig('dailyReportSettings', JSON.stringify(config.dailyReportSettings));
            }
            
            // 保存其他配置字段（如果存在且不为null）
            if (config.lastCheckTime !== null && config.lastCheckTime !== undefined && config.lastCheckTime !== '') {
                await database.setConfig('lastCheckTime', config.lastCheckTime);
            }
            if (config.lastEmailSent !== null && config.lastEmailSent !== undefined && config.lastEmailSent !== '') {
                await database.setConfig('lastEmailSent', config.lastEmailSent);
            }
            
            // 更新内存中的配置
            this.config = config;
        } catch (error) {
            throw new Error(`保存配置到数据库失败: ${error.message}`);
        }
    }

    /**
     * 合并配置对象
     * @param {Object} defaultConfig - 默认配置
     * @param {Object} userConfig - 用户配置
     * @returns {Object} 合并后的配置
     */
    mergeConfig(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        for (const key in userConfig) {
            if (userConfig.hasOwnProperty(key)) {
                if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
                    merged[key] = { ...defaultConfig[key], ...userConfig[key] };
                } else {
                    merged[key] = userConfig[key];
                }
            }
        }
        
        // 特殊处理：如果旧配置中有toEmail，需要迁移到toEmails
        if (merged.emailSettings && merged.emailSettings.toEmail && !merged.emailSettings.toEmails) {
            merged.emailSettings.toEmails = [merged.emailSettings.toEmail];
            delete merged.emailSettings.toEmail;
        }
        
        // 确保toEmails是数组
        if (merged.emailSettings && !Array.isArray(merged.emailSettings.toEmails)) {
            merged.emailSettings.toEmails = [];
        }
        
        return merged;
    }

    /**
     * 获取完整配置
     * @returns {Object} 配置对象
     */
    async getConfig() {
        // 如果内存中没有配置，尝试从数据库加载
        if (!this.config) {
            try {
                await this.loadConfigFromDatabase();
            } catch (error) {
                console.log('从数据库加载配置失败，使用默认配置');
                this.config = this.defaultConfig;
            }
        }
        return this.config || this.defaultConfig;
    }

    /**
     * 更新域名列表
     * @param {Array} domains - 域名列表
     * @returns {Promise<void>}
     */
    async updateDomains(domains) {
        const config = await this.getConfig();
        config.domains = domains;
        await this.saveConfig(config);
    }

    /**
     * 添加域名
     * @param {string} domain - 域名
     * @returns {Promise<void>}
     */
    async addDomain(domain) {
        const config = await this.getConfig();
        if (!config.domains.includes(domain)) {
            config.domains.push(domain);
            await this.saveConfig(config);
            
            // 保存到数据库
            await database.addDomain(domain);
        }
    }

    /**
     * 删除域名
     * @param {string} domain - 域名
     * @returns {Promise<void>}
     */
    async removeDomain(domain) {
        const config = await this.getConfig();
        config.domains = config.domains.filter(d => d !== domain);
        await this.saveConfig(config);
        
        // 从数据库删除
        await database.removeDomain(domain);
    }

    /**
     * 更新邮件设置
     * @param {Object} emailSettings - 邮件设置
     * @returns {Promise<void>}
     */
    async updateEmailSettings(emailSettings) {
        const config = await this.getConfig();
        config.emailSettings = { ...config.emailSettings, ...emailSettings };
        await this.saveConfig(config);
    }

    /**
     * 添加邮箱
     * @param {string} email - 邮箱地址
     * @returns {Promise<void>}
     */
    async addEmail(email) {
        const config = await this.getConfig();
        if (!config.emailSettings.toEmails) {
            config.emailSettings.toEmails = [];
        }
        if (!config.emailSettings.toEmails.includes(email)) {
            config.emailSettings.toEmails.push(email);
            await this.saveConfig(config);
            
            // 保存到数据库
            await database.addEmail(email);
        }
    }

    /**
     * 删除邮箱
     * @param {string} email - 邮箱地址
     * @returns {Promise<void>}
     */
    async removeEmail(email) {
        const config = await this.getConfig();
        if (config.emailSettings.toEmails) {
            config.emailSettings.toEmails = config.emailSettings.toEmails.filter(e => e !== email);
            await this.saveConfig(config);
            
            // 从数据库删除
            await database.removeEmail(email);
        }
    }

    /**
     * 获取所有邮箱
     * @returns {Array} 邮箱列表
     */
    async getEmails() {
        const config = await this.getConfig();
        return config.emailSettings.toEmails || [];
    }

    /**
     * 更新定时任务设置
     * @param {Object} scheduleSettings - 定时任务设置
     * @returns {Promise<void>}
     */
    async updateScheduleSettings(scheduleSettings) {
        const config = await this.getConfig();
        config.scheduleSettings = { ...config.scheduleSettings, ...scheduleSettings };
        await this.saveConfig(config);
    }

    /**
     * 获取域名列表
     * @returns {Array} 域名列表
     */
    async getDomains() {
        const config = await this.getConfig();
        return config.domains;
    }

    /**
     * 获取邮件设置
     * @returns {Object} 邮件设置
     */
    async getEmailSettings() {
        const config = await this.getConfig();
        return config.emailSettings;
    }

    /**
     * 获取定时任务设置
     * @returns {Object} 定时任务设置
     */
    async getScheduleSettings() {
        const config = await this.getConfig();
        return config.scheduleSettings;
    }

    /**
     * 更新最后检查时间
     * @param {string} timestamp - 时间戳
     * @returns {Promise<void>}
     */
    async updateLastCheckTime(timestamp) {
        const config = await this.getConfig();
        config.lastCheckTime = timestamp;
        await this.saveConfig(config);
    }

    /**
     * 更新最后邮件发送时间
     * @param {string} timestamp - 时间戳
     * @returns {Promise<void>}
     */
    async updateLastEmailSent(timestamp) {
        const config = await this.getConfig();
        config.lastEmailSent = timestamp;
        await this.saveConfig(config);
    }

    /**
     * 获取最后检查时间
     * @returns {string|null} 最后检查时间
     */
    async getLastCheckTime() {
        const config = await this.getConfig();
        return config.lastCheckTime;
    }

    /**
     * 获取最后邮件发送时间
     * @returns {string|null} 最后邮件发送时间
     */
    async getLastEmailSent() {
        const config = await this.getConfig();
        return config.lastEmailSent;
    }

    /**
     * 获取日报设置
     * @returns {Object} 日报设置
     */
    async getDailyReportSettings() {
        const config = await this.getConfig();
        return config.dailyReportSettings || {
            enabled: false,
            time: '08:00',
            timezone: 'Asia/Shanghai'
        };
    }

    /**
     * 更新日报设置
     * @param {Object} dailyReportSettings - 日报设置
     * @returns {Promise<void>}
     */
    async updateDailyReportSettings(dailyReportSettings) {
        const config = await this.getConfig();
        config.dailyReportSettings = dailyReportSettings;
        await this.saveConfig(config);
    }

    /**
     * 更新完整配置
     * @param {Object} newConfig - 新配置对象
     * @returns {Promise<boolean>} 更新结果
     */
    async updateConfig(newConfig) {
        try {
            const currentConfig = await this.getConfig();
            
            // 合并配置，只更新提供的字段
            const updatedConfig = { ...currentConfig };
            
            if (newConfig.domains !== undefined) {
                updatedConfig.domains = newConfig.domains;
            }
            
            if (newConfig.emailSettings !== undefined) {
                updatedConfig.emailSettings = { ...currentConfig.emailSettings, ...newConfig.emailSettings };
            }
            
            if (newConfig.scheduleSettings !== undefined) {
                updatedConfig.scheduleSettings = { ...currentConfig.scheduleSettings, ...newConfig.scheduleSettings };
            }
            
            if (newConfig.smtpConfig !== undefined) {
                updatedConfig.smtpConfig = newConfig.smtpConfig;
            }
            
            if (newConfig.dailyReportSettings !== undefined) {
                updatedConfig.dailyReportSettings = newConfig.dailyReportSettings;
            }
            
            await this.saveConfig(updatedConfig);
            return true;
        } catch (error) {
            console.error('更新配置失败:', error);
            return false;
        }
    }
}

module.exports = new ConfigManager();

