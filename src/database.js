const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * 数据库管理器
 */
class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'data', 'cert-alarm.db');
        this.db = null;
    }

    /**
     * 初始化数据库
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            try {
                // 确保数据目录存在
                const fs = require('fs');
                const dataDir = path.dirname(this.dbPath);
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }

                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('数据库连接失败:', err);
                        reject(err);
                    } else {
                        console.log('成功连接到SQLite数据库');
                        this.createTables().then(resolve).catch(reject);
                    }
                });
            } catch (error) {
                console.error('数据库初始化失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 创建数据表
     */
    async createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                -- 配置表
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                -- 域名表
                CREATE TABLE IF NOT EXISTS domains (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- 邮箱表
                CREATE TABLE IF NOT EXISTS emails (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- 证书检查记录表
                CREATE TABLE IF NOT EXISTS cert_checks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT NOT NULL,
                    status TEXT NOT NULL,
                    issuer TEXT,
                    subject TEXT,
                    valid_from TEXT,
                    valid_to TEXT,
                    expiry_date TEXT,
                    days_until_expiry INTEGER,
                    is_valid BOOLEAN,
                    is_expiring BOOLEAN,
                    fingerprint TEXT,
                    error_message TEXT,
                    check_time DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- 系统日志表
                CREATE TABLE IF NOT EXISTS system_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    level TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                -- 日报发送幂等锁表（每天仅发送一次）
                CREATE TABLE IF NOT EXISTS daily_report_log (
                    date TEXT PRIMARY KEY,
                    sent_at TEXT
                );
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 获取配置
     */
    async getConfig(key) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? JSON.parse(row.value) : null);
                }
            });
        });
    }

    /**
     * 设置配置
     */
    async setConfig(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
                [key, JSON.stringify(value)],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * 获取所有域名
     */
    async getDomains() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }
            
            this.db.all('SELECT domain FROM domains ORDER BY created_at', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.domain));
                }
            });
        });
    }

    /**
     * 添加域名
     */
    async addDomain(domain) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR IGNORE INTO domains (domain) VALUES (?)', [domain], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 删除域名
     */
    async removeDomain(domain) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM domains WHERE domain = ?', [domain], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 获取所有邮箱
     */
    async getEmails() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT email FROM emails ORDER BY created_at', (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map(row => row.email));
                }
            });
        });
    }

    /**
     * 添加邮箱
     */
    async addEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.run('INSERT OR IGNORE INTO emails (email) VALUES (?)', [email], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 删除邮箱
     */
    async removeEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM emails WHERE email = ?', [email], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 记录证书检查结果
     */
    async recordCertCheck(checkResult) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO cert_checks (
                    domain, status, issuer, subject, valid_from, valid_to,
                    expiry_date, days_until_expiry, is_valid, is_expiring,
                    fingerprint, error_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                checkResult.domain,
                checkResult.status,
                checkResult.issuer,
                checkResult.subject,
                checkResult.validFrom,
                checkResult.validTo,
                checkResult.expiryDate,
                checkResult.daysUntilExpiry,
                checkResult.isValid,
                checkResult.isExpiring,
                checkResult.fingerprint,
                checkResult.error
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 获取最新的证书检查结果
     */
    async getLatestCertChecks() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT * FROM cert_checks 
                WHERE id IN (
                    SELECT MAX(id) FROM cert_checks 
                    GROUP BY domain
                )
                ORDER BY check_time DESC
            `;
            
            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 试图获取当日日报发送锁（原子化）
     * @param {string} dateYYYYMMDD - 日期字符串 YYYY-MM-DD
     * @returns {Promise<boolean>} 是否获取成功
     */
    async tryAcquireDailySendLock(dateYYYYMMDD) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('数据库未初始化'));
            const sql = `INSERT OR IGNORE INTO daily_report_log(date, sent_at) VALUES(?, NULL)`;
            this.db.run(sql, [dateYYYYMMDD], function(err) {
                if (err) return reject(err);
                // changes === 1 表示插入成功，拿到锁
                resolve((this && this.changes) === 1);
            });
        });
    }

    /**
     * 标记当日日报已发送
     */
    async markDailyReportSent(dateYYYYMMDD, sentAtISO) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('数据库未初始化'));
            const sql = `UPDATE daily_report_log SET sent_at = ? WHERE date = ?`;
            this.db.run(sql, [sentAtISO, dateYYYYMMDD], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * 释放当日锁（用于当日允许重发的场景）
     */
    async releaseDailySendLock(dateYYYYMMDD) {
        return new Promise((resolve, reject) => {
            if (!this.db) return reject(new Error('数据库未初始化'));
            const sql = `DELETE FROM daily_report_log WHERE date = ?`;
            this.db.run(sql, [dateYYYYMMDD], function(err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * 记录系统日志
     */
    async log(level, message) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO system_logs (level, message) VALUES (?, ?)',
                [level, message],
                (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * 保存证书检查结果
     * @param {Object} checkData - 检查数据
     * @returns {Promise<void>}
     */
    async saveCertCheck(checkData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }
            
            const sql = `
                INSERT INTO cert_checks (
                    domain, status, issuer, subject, valid_from, valid_to,
                    expiry_date, days_until_expiry, is_valid, is_expiring,
                    fingerprint, error_message, check_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                checkData.domain,
                checkData.status,
                checkData.issuer,
                checkData.subject,
                checkData.valid_from,
                checkData.valid_to,
                checkData.expiry_date,
                checkData.days_until_expiry,
                checkData.is_valid,
                checkData.is_expiring,
                checkData.fingerprint,
                checkData.error_message,
                checkData.check_time
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 获取最新的证书检查结果
     * @returns {Promise<Array>} 检查结果列表
     */
    async getLatestCertChecks() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
            }
            
            const sql = `
                SELECT c1.* FROM cert_checks c1
                INNER JOIN (
                    SELECT domain, MAX(check_time) as max_time
                    FROM cert_checks
                    GROUP BY domain
                ) c2 ON c1.domain = c2.domain AND c1.check_time = c2.max_time
                ORDER BY c1.check_time DESC
            `;
            
            this.db.all(sql, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 关闭数据库连接
     */
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = new Database();
