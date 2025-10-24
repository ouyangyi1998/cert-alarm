#!/usr/bin/env node

/**
 * 将JSON配置迁移到数据库
 */

const fs = require('fs').promises;
const path = require('path');
const database = require('./src/database');

async function migrateConfig() {
    try {
        console.log('开始迁移配置到数据库...');
        
        // 初始化数据库
        await database.initialize();
        console.log('✅ 数据库初始化完成');
        
        // 读取现有JSON配置
        const configPath = './config/config.json';
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        console.log('📄 读取到JSON配置:', {
            domains: config.domains?.length || 0,
            emails: config.emailSettings?.toEmails?.length || 0
        });
        
        // 迁移域名
        if (config.domains && config.domains.length > 0) {
            for (const domain of config.domains) {
                await database.addDomain(domain);
                console.log(`✅ 迁移域名: ${domain}`);
            }
        }
        
        // 迁移邮箱
        if (config.emailSettings?.toEmails && config.emailSettings.toEmails.length > 0) {
            for (const email of config.emailSettings.toEmails) {
                await database.addEmail(email);
                console.log(`✅ 迁移邮箱: ${email}`);
            }
        }
        
        // 保存其他配置
        if (config.emailSettings) {
            await database.setConfig('emailSettings', config.emailSettings);
            console.log('✅ 迁移邮件设置');
        }
        
        if (config.scheduleSettings) {
            await database.setConfig('scheduleSettings', config.scheduleSettings);
            console.log('✅ 迁移定时任务设置');
        }
        
        if (config.lastCheckTime) {
            await database.setConfig('lastCheckTime', config.lastCheckTime);
            console.log('✅ 迁移最后检查时间');
        }
        
        if (config.lastEmailSent) {
            await database.setConfig('lastEmailSent', config.lastEmailSent);
            console.log('✅ 迁移最后邮件发送时间');
        }
        
        console.log('\n🎉 配置迁移完成！');
        console.log('现在系统将使用数据库存储配置，不再依赖JSON文件。');
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        process.exit(1);
    } finally {
        database.close();
    }
}

// 运行迁移
if (require.main === module) {
    migrateConfig();
}

module.exports = { migrateConfig };
