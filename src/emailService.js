const nodemailer = require('nodemailer');
const moment = require('moment');
const configManager = require('./configManager');

/**
 * 邮件服务类
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    /**
     * 重新初始化邮件传输器（使用数据库中的SMTP配置）
     */
    async reinitializeTransporter() {
        try {
            const config = await configManager.getConfig();
            if (config.smtpConfig) {
                const smtpConfig = config.smtpConfig;
                // 根据端口号自动设置安全连接
                const isSecure = smtpConfig.port === 465 || smtpConfig.secure === true;
                const transporterOptions = {
                    host: smtpConfig.host,
                    port: smtpConfig.port,
                    secure: isSecure,
                    auth: {
                        user: smtpConfig.user,
                        pass: smtpConfig.pass
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                };
                
                this.transporter = nodemailer.createTransport(transporterOptions);
                console.log('已使用数据库中的SMTP配置重新初始化邮件传输器');
                return true;
            } else {
                console.log('数据库中没有SMTP配置，使用环境变量');
                this.initializeTransporter();
                return false;
            }
        } catch (error) {
            console.error('重新初始化邮件传输器失败:', error);
            this.initializeTransporter();
            return false;
        }
    }

    /**
     * 初始化邮件传输器
     */
    initializeTransporter() {
        const port = Number(process.env.SMTP_PORT || 587);
        const secureEnv = process.env.SMTP_SECURE; // 'true' | 'false' | undefined
        const secure = typeof secureEnv === 'string'
            ? secureEnv.toLowerCase() === 'true'
            : port === 465; // 465通常为SSL

        const requireTLS = (process.env.SMTP_REQUIRE_TLS || 'false').toLowerCase() === 'true';
        const ignoreTLS = (process.env.SMTP_IGNORE_TLS || 'false').toLowerCase() === 'true';
        const rejectUnauthorized = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';

        const baseOptions = {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            requireTLS,
            ignoreTLS,
            tls: {
                rejectUnauthorized
            }
        };

        // 可选：使用预置service（如 'qq', 'gmail', '163', '126', 'hotmail' 等）
        if (process.env.SMTP_SERVICE) {
            baseOptions.service = process.env.SMTP_SERVICE;
        }

        this.transporter = nodemailer.createTransport(baseOptions);
    }

    /**
     * 验证邮件配置
     * @returns {Promise<boolean>} 验证结果
     */
    async verifyConnection() {
        try {
            // 首先尝试使用数据库中的SMTP配置重新初始化
            await this.reinitializeTransporter();
            await this.transporter.verify();
            return true;
        } catch (error) {
            console.error('邮件配置验证失败:', error);
            return false;
        }
    }

    /**
     * 发送证书到期提醒邮件
     * @param {Array} expiringCerts - 即将到期的证书列表
     * @param {string|Array} toEmails - 接收邮箱（支持单个邮箱或邮箱数组）
     * @param {number} warningDays - 预警天数
     * @returns {Promise<boolean>} 发送结果
     */
    async sendCertificateAlert(expiringCerts, toEmails, warningDays = 30) {
        try {
            const subject = `SSL证书到期提醒 - ${moment().format('YYYY-MM-DD')}`;
            
            let htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d32f2f;">🔔 SSL证书到期提醒</h2>
                    <p>您好，</p>
                    <p>检测到以下域名的SSL证书将在${warningDays}天内到期，请及时更新：</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">域名</th>
                                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">到期时间</th>
                                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">剩余天数</th>
                                <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">状态</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            expiringCerts.forEach(cert => {
                const statusColor = cert.daysUntilExpiry <= 7 ? '#d32f2f' : 
                                  cert.daysUntilExpiry <= 15 ? '#f57c00' : '#ff9800';
                
                htmlContent += `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 12px;">${cert.domain}</td>
                        <td style="border: 1px solid #ddd; padding: 12px;">${cert.expiryDate}</td>
                        <td style="border: 1px solid #ddd; padding: 12px; color: ${statusColor}; font-weight: bold;">
                            ${cert.daysUntilExpiry} 天
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; color: ${statusColor};">
                            ${cert.daysUntilExpiry <= 7 ? '紧急' : cert.daysUntilExpiry <= 15 ? '警告' : '提醒'}
                        </td>
                    </tr>
                `;
            });

            htmlContent += `
                        </tbody>
                    </table>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #1976d2; margin-top: 0;">建议操作：</h3>
                        <ul>
                            <li>立即访问证书提供商网站更新证书</li>
                            <li>确保证书更新后重新部署到服务器</li>
                            <li>建议设置自动续期以避免类似问题</li>
                        </ul>
                    </div>
                    <p style="color: #666; font-size: 12px;">
                        此邮件由SSL证书监控系统自动发送，发送时间：${moment().format('YYYY-MM-DD HH:mm:ss')}
                    </p>
                </div>
            `;

            // 确保toEmails是数组
            const emailList = Array.isArray(toEmails) ? toEmails : [toEmails];
            
            // 过滤掉空邮箱
            const validEmails = emailList.filter(email => email && email.trim());
            
            if (validEmails.length === 0) {
                console.log('没有有效的接收邮箱');
                return false;
            }

            const mailOptions = {
                from: process.env.FROM_EMAIL || process.env.SMTP_USER,
                to: validEmails.join(','), // 多个邮箱用逗号分隔
                subject: subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`证书提醒邮件发送成功到 ${validEmails.length} 个邮箱:`, result.messageId);
            return true;

        } catch (error) {
            console.error('发送证书提醒邮件失败:', error);
            return false;
        }
    }

    /**
     * 发送测试邮件
     * @param {string|Array} toEmails - 接收邮箱（支持单个邮箱或邮箱数组）
     * @returns {Promise<boolean>} 发送结果
     */
    async sendTestEmail(toEmails) {
        try {
            // 首先尝试使用数据库中的SMTP配置重新初始化
            await this.reinitializeTransporter();
            
            // 确保toEmails是数组
            const emailList = Array.isArray(toEmails) ? toEmails : [toEmails];
            
            // 过滤掉空邮箱
            const validEmails = emailList.filter(email => email && email.trim());
            
            if (validEmails.length === 0) {
                console.log('没有有效的接收邮箱');
                return false;
            }

            // 获取发送方邮箱
            const config = await configManager.getConfig();
            const fromEmail = config.smtpConfig ? config.smtpConfig.from : (process.env.FROM_EMAIL || process.env.SMTP_USER);

            const mailOptions = {
                from: fromEmail,
                to: validEmails.join(','), // 多个邮箱用逗号分隔
                subject: 'SSL证书监控系统 - 测试邮件',
                html: `
                    <div style="font-family: Arial, sans-serif;">
                        <h2>🎉 邮件配置测试成功！</h2>
                        <p>如果您收到这封邮件，说明SSL证书监控系统的邮件配置正确。</p>
                        <p>系统将按时监控您配置的域名证书状态，并在证书即将到期时发送提醒。</p>
                        <p style="color: #666; font-size: 12px;">
                            测试时间：${moment().format('YYYY-MM-DD HH:mm:ss')}
                        </p>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`测试邮件发送成功到 ${validEmails.length} 个邮箱:`, result.messageId);
            return true;

        } catch (error) {
            console.error('发送测试邮件失败:', error);
            return false;
        }
    }

    /**
     * 发送证书监控日报
     * @param {Array} toEmails - 接收邮箱列表
     * @param {Object} reportData - 日报数据
     * @returns {Promise<boolean>} 发送结果
     */
    async sendDailyReport(toEmails, reportData) {
        try {
            // 重新初始化邮件传输器以使用数据库中的SMTP配置
            await this.reinitializeTransporter();
            
            // 确保toEmails是数组
            const emailList = Array.isArray(toEmails) ? toEmails : [toEmails];
            
            // 过滤掉空邮箱
            const validEmails = emailList.filter(email => email && email.trim());
            
            if (validEmails.length === 0) {
                console.log('没有有效的接收邮箱');
                return false;
            }

            const { total, healthy, expiring, failed, results, expiringCerts, failedCerts } = reportData;
            const currentDate = new Date().toLocaleDateString('zh-CN');
            
            // 生成HTML报告
            let htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                    <h2 style="color: #1976d2; text-align: center;">📊 SSL证书监控日报 - ${currentDate}</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #1976d2; margin-top: 0;">📈 监控概览</h3>
                        <div style="display: flex; justify-content: space-around; text-align: center;">
                            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h4 style="margin: 0; color: #666;">总域名数</h4>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #333;">${total}</p>
                            </div>
                            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h4 style="margin: 0; color: #4caf50;">正常证书</h4>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #4caf50;">${healthy}</p>
                            </div>
                            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h4 style="margin: 0; color: #ff9800;">即将到期</h4>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #ff9800;">${expiring}</p>
                            </div>
                            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h4 style="margin: 0; color: #f44336;">检查失败</h4>
                                <p style="font-size: 24px; font-weight: bold; margin: 5px 0; color: #f44336;">${failed}</p>
                            </div>
                        </div>
                    </div>
            `;

            // 添加即将到期的证书
            if (expiringCerts && expiringCerts.length > 0) {
                htmlContent += `
                    <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                        <h3 style="color: #856404; margin-top: 0;">⚠️ 即将到期的证书</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">域名</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">到期时间</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">剩余天数</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">检测时间</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">状态</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                expiringCerts.forEach(cert => {
                    const statusColor = cert.daysUntilExpiry <= 7 ? '#d32f2f' : '#f57c00';
                    const statusText = cert.daysUntilExpiry <= 7 ? '紧急' : '即将到期';
                    htmlContent += `
                        <tr>
                            <td style="border: 1px solid #dee2e6; padding: 12px; font-weight: bold;">${cert.domain}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${cert.expiryDate}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: ${statusColor}; font-weight: bold;">${cert.daysUntilExpiry} 天</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: #666; font-size: 12px;">${cert.lastCheckTime || '-'}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                        </tr>
                    `;
                });
                
                htmlContent += `
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // 添加检查失败的证书
            if (failedCerts && failedCerts.length > 0) {
                htmlContent += `
                    <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                        <h3 style="color: #721c24; margin-top: 0;">❌ 检查失败的证书</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">域名</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">错误信息</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                failedCerts.forEach(cert => {
                    htmlContent += `
                        <tr>
                            <td style="border: 1px solid #dee2e6; padding: 12px; font-weight: bold;">${cert.domain}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: #dc3545;">${cert.error}</td>
                        </tr>
                    `;
                });
                
                htmlContent += `
                            </tbody>
                        </table>
                    </div>
                `;
            }

            // 添加所有证书详情
            if (results && results.length > 0) {
                htmlContent += `
                    <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #1976d2;">
                        <h3 style="color: #1976d2; margin-top: 0;">📋 所有证书详情</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f8f9fa;">
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">域名</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">状态</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">到期时间</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">剩余天数</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">检测时间</th>
                                    <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">颁发者</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                results.forEach(cert => {
                    let statusColor = '#4caf50';
                    let statusText = '正常';
                    
                    if (cert.status === 'success') {
                        if (cert.daysUntilExpiry <= 7) {
                            statusColor = '#d32f2f';
                            statusText = '紧急';
                        } else if (cert.daysUntilExpiry <= 30) {
                            statusColor = '#f57c00';
                            statusText = '即将到期';
                        }
                    } else if (cert.status === 'cloudflare_protected') {
                        statusColor = '#2196f3';
                        statusText = 'Cloudflare保护';
                    } else {
                        statusColor = '#d32f2f';
                        statusText = '检查失败';
                    }
                    
                    htmlContent += `
                        <tr>
                            <td style="border: 1px solid #dee2e6; padding: 12px; font-weight: bold;">${cert.domain}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: ${statusColor}; font-weight: bold;">${statusText}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${cert.expiryDate || '-'}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${cert.daysUntilExpiry ? cert.daysUntilExpiry + ' 天' : '-'}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px; color: #666; font-size: 12px;">${cert.lastCheckTime || '-'}</td>
                            <td style="border: 1px solid #dee2e6; padding: 12px;">${cert.issuer || '-'}</td>
                        </tr>
                    `;
                });
                
                htmlContent += `
                            </tbody>
                        </table>
                    </div>
                `;
            }

            htmlContent += `
                    <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 5px; border-left: 4px solid #6c757d;">
                        <h4 style="color: #495057; margin-top: 0;">📝 报告信息</h4>
                        <p><strong>报告生成时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
                        <p><strong>系统状态:</strong> <span style="color: #28a745;">运行正常</span></p>
                        <p style="color: #6c757d; font-size: 14px; margin-bottom: 0;">
                            此报告由SSL证书监控系统自动生成，如有疑问请联系系统管理员。
                        </p>
                    </div>
                </div>
            `;

            // 获取发送方邮箱地址
            const config = await configManager.getConfig();
            const fromEmail = config.smtpConfig ? config.smtpConfig.from : (process.env.FROM_EMAIL || process.env.SMTP_USER);
            
            const mailOptions = {
                from: fromEmail,
                to: validEmails.join(','),
                subject: `📊 SSL证书监控日报 - ${currentDate}`,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`日报邮件发送成功到 ${validEmails.length} 个邮箱:`, result.messageId);
            return true;

        } catch (error) {
            console.error('发送日报邮件失败:', error);
            return false;
        }
    }
}

module.exports = new EmailService();

