const nodemailer = require('nodemailer');
const moment = require('moment');

/**
 * 邮件服务类
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
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
}

module.exports = new EmailService();

