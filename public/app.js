// SSL证书监控系统前端JavaScript

// 全局变量
let currentData = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('SSL证书监控系统前端已加载');
    loadSystemStatus();
    loadSystemData();
    loadDomainsTable();
    loadEmailConfigs();
    loadScheduleConfigs();
    
    // 绑定表单提交事件
    const emailForm = document.getElementById('email-form');
    const scheduleForm = document.getElementById('schedule-form');
    
    if (emailForm) {
        emailForm.addEventListener('submit', handleEmailFormSubmit);
    } else {
        console.warn('email-form not found');
    }
    
    if (scheduleForm) {
        scheduleForm.addEventListener('submit', handleScheduleFormSubmit);
    } else {
        console.warn('schedule-form not found');
    }
    
    // 设置定时刷新（移除自动刷新，避免重复检查）
    // setInterval(loadSystemData, 30000); // 每30秒刷新一次
});

// 加载系统状态
async function loadSystemStatus() {
    try {
        const response = await fetch('/api/status');
        const result = await response.json();
        
        if (result.success) {
            currentData = result.data;
            updateSystemStatus(result.data);
            updateOverviewCards(result.data);
            // 数据加载完成后，更新配置显示
            loadDomainsTable();
            loadEmailConfigs();
            loadScheduleConfigs();
            
            // 如果有检查结果，更新概况页面
            if (currentData.checkResults && currentData.checkResults.results) {
                updateRecentCheckResults(currentData.checkResults);
            }
        } else {
            showError('获取系统状态失败: ' + result.message);
        }
    } catch (error) {
        console.error('加载系统状态失败:', error);
        showError('无法连接到服务器');
    }
}

// 更新系统状态显示
function updateSystemStatus(data) {
    const statusElement = document.getElementById('system-status');
    if (!statusElement) return;
    
    const scheduler = data.scheduler;
    const config = data.config;
    
    let statusHtml = `
        <div class="row">
            <div class="col-6">
                <strong>定时任务:</strong> ${scheduler.taskActive ? '已启用' : '已禁用'}<br>
                <strong>执行时间:</strong> ${scheduler.cronExpression}<br>
                <strong>时区:</strong> ${scheduler.timezone}
            </div>
            <div class="col-6">
                <strong>监控域名:</strong> ${config.domains.length} 个<br>
                <strong>接收邮箱:</strong> ${config.emailSettings.toEmails ? config.emailSettings.toEmails.length : 0} 个<br>
                <strong>预警天数:</strong> ${config.emailSettings.warningDays} 天
            </div>
        </div>
    `;
    
    if (scheduler.lastCheckTime) {
        statusHtml += `<br><strong>最后检查:</strong> ${scheduler.lastCheckTime}`;
    }
    
    statusElement.innerHTML = statusHtml;
}

// 更新概览卡片
function updateOverviewCards(data) {
    const config = data.config;
    const domains = config.domains || [];
    
    // 更新监控域名数量
    document.getElementById('total-domains').textContent = domains.length;
    
    // 如果有检查结果，更新其他卡片
    if (currentData && currentData.checkResults) {
        const results = currentData.checkResults;
        document.getElementById('healthy-certs').textContent = results.healthy || 0;
        document.getElementById('expiring-certs').textContent = results.expiring || 0;
        document.getElementById('failed-certs').textContent = results.failed || 0;
    } else {
        // 默认显示0
        document.getElementById('healthy-certs').textContent = '0';
        document.getElementById('expiring-certs').textContent = '0';
        document.getElementById('failed-certs').textContent = '0';
    }
}

// 更新检查结果统计数据
function updateCheckResultsStats() {
    if (!currentData || !currentData.checkResults || !currentData.checkResults.results) {
        return;
    }
    
    const results = currentData.checkResults.results;
    const warningDays = currentData.config.emailSettings.warningDays || 30;
    
    let healthy = 0;
    let expiring = 0;
    let failed = 0;
    
    results.forEach(result => {
        if (result.status === 'success') {
            if (result.daysUntilExpiry <= warningDays && result.daysUntilExpiry > 0) {
                expiring++;
            } else if (result.daysUntilExpiry > 0) {
                healthy++;
            }
        } else {
            failed++;
        }
    });
    
    currentData.checkResults.healthy = healthy;
    currentData.checkResults.expiring = expiring;
    currentData.checkResults.failed = failed;
    currentData.checkResults.total = results.length;
    
    // 更新概览卡片
    updateOverviewCards(currentData);
}

// 加载系统数据
async function loadSystemData() {
    try {
        const response = await fetch('/api/status');
        const result = await response.json();
        
        if (result.success) {
            currentData = result.data;
            updateOverviewCards(result.data);
            loadDomainsTable();
        }
    } catch (error) {
        console.error('加载系统数据失败:', error);
    }
}

// 加载域名表格
function loadDomainsTable() {
    const domainsTable = document.getElementById('domains-table');
    if (!domainsTable || !currentData) return;
    
    const domains = currentData.config.domains || [];
    
    if (domains.length === 0) {
        domainsTable.innerHTML = '<tr><td colspan="5" class="text-center text-muted">暂无域名</td></tr>';
        return;
    }
    
    let tableHtml = '';
    domains.forEach(domain => {
        // 如果有检查结果，显示详细信息
        if (currentData.checkResults && currentData.checkResults.results) {
            const domainResult = currentData.checkResults.results.find(r => r.domain === domain);
            if (domainResult && domainResult.status === 'success') {
                const statusClass = domainResult.daysUntilExpiry <= 7 ? 'danger' : 
                                  domainResult.daysUntilExpiry <= 30 ? 'warning' : 'success';
                const statusText = domainResult.daysUntilExpiry <= 7 ? '紧急' : 
                                 domainResult.daysUntilExpiry <= 30 ? '即将到期' : '正常';
                
                const lastCheckTime = domainResult.lastCheckTime || '未检查';
                tableHtml += `
                    <tr>
                        <td>${domain}</td>
                        <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                        <td>${domainResult.expiryDate}</td>
                        <td>${domainResult.daysUntilExpiry} 天</td>
                        <td>${lastCheckTime}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                                <i class="bi bi-arrow-clockwise"></i> 检查
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </td>
                    </tr>
                `;
            } else if (domainResult && domainResult.status === 'cloudflare_protected') {
                // 显示Cloudflare保护状态
                tableHtml += `
                    <tr>
                        <td>${domain}</td>
                        <td><span class="badge bg-info">Cloudflare保护</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                            <small class="text-muted text-info">${domainResult.message}</small><br>
                            <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                                <i class="bi bi-arrow-clockwise"></i> 重新检查
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </td>
                    </tr>
                `;
            } else if (domainResult && domainResult.status === 'error') {
                // 显示检查失败的具体错误
                tableHtml += `
                    <tr>
                        <td>${domain}</td>
                        <td><span class="badge bg-danger">检查失败</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                            <small class="text-muted text-danger">错误: ${domainResult.error}</small><br>
                            <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                                <i class="bi bi-arrow-clockwise"></i> 重新检查
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </td>
                    </tr>
                `;
            } else {
                // 检查结果存在但状态未知
                tableHtml += `
                    <tr>
                        <td>${domain}</td>
                        <td><span class="badge bg-warning">状态未知</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                                <i class="bi bi-arrow-clockwise"></i> 检查
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                                <i class="bi bi-trash"></i> 删除
                            </button>
                        </td>
                    </tr>
                `;
            }
        } else {
            // 没有检查结果时显示基本信息
            tableHtml += `
                <tr>
                    <td>${domain}</td>
                    <td><span class="badge bg-secondary">未检查</span></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                            <i class="bi bi-arrow-clockwise"></i> 检查
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                            <i class="bi bi-trash"></i> 删除
                        </button>
                    </td>
                </tr>
            `;
        }
    });
    
    domainsTable.innerHTML = tableHtml;
}

// 手动检查证书
async function manualCheck() {
    showLoading('正在检查证书...');
    
    try {
        const response = await fetch('/api/check-certificates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentData.checkResults = result.data;
            updateOverviewCards(currentData);
            updateRecentCheckResults(result.data);
            showSuccess('证书检查完成');
        } else {
            showError('证书检查失败: ' + result.message);
        }
    } catch (error) {
        console.error('手动检查失败:', error);
        showError('证书检查失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 更新最近检查结果
function updateRecentCheckResults(data) {
    const resultsElement = document.getElementById('recent-check-results');
    if (!resultsElement) return;
    
    let html = '';
    
    if (data && data.results && data.results.length > 0) {
        html = `
            <div class="alert alert-info">
                <strong>检查时间:</strong> ${data.lastCheckTime || new Date().toLocaleString()}<br>
                <strong>检查结果:</strong> 总计 ${data.total || 0} 个域名<br>
                <strong>正常:</strong> ${data.healthy || 0} 个 | 
                <strong>即将到期:</strong> ${data.expiring || 0} 个 | 
                <strong>检查失败:</strong> ${data.failed || 0} 个
            </div>
        `;
        
        // 显示即将到期的证书
        if (data.expiringCerts && data.expiringCerts.length > 0) {
            html += '<div class="alert alert-warning"><strong>即将到期的证书:</strong><ul>';
            data.expiringCerts.forEach(cert => {
                html += `<li>${cert.domain} - 剩余 ${cert.daysUntilExpiry} 天</li>`;
            });
            html += '</ul></div>';
        }
        
        // 显示检查失败的域名
        if (data.failedCerts && data.failedCerts.length > 0) {
            html += '<div class="alert alert-danger"><strong>检查失败的域名:</strong><ul>';
            data.failedCerts.forEach(cert => {
                html += `<li>${cert.domain} - ${cert.error}</li>`;
            });
            html += '</ul></div>';
        }
        
        // 显示所有检查结果
        html += '<div class="list-group mt-2">';
        data.results.forEach(result => {
            const statusClass = result.status === 'success' ? 'success' : 
                              result.status === 'cloudflare_protected' ? 'info' : 'danger';
            const statusText = result.status === 'success' ? '正常' : 
                             result.status === 'cloudflare_protected' ? 'Cloudflare保护' : '失败';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${result.domain}</h6>
                        <span class="badge bg-${statusClass}">${statusText}</span>
                    </div>
                    ${result.status === 'success' ? 
                        `<p class="mb-1">剩余天数: ${result.daysUntilExpiry} 天</p>` : 
                        `<p class="mb-1 text-muted">${result.error || result.message}</p>`
                    }
                </div>
            `;
        });
        html += '</div>';
    } else {
        html = '<p class="text-muted">暂无检查结果</p>';
    }
    
    resultsElement.innerHTML = html;
}

// 刷新状态
function refreshStatus() {
    loadSystemStatus();
    showSuccess('状态已刷新');
}

// 发送测试邮件
async function sendTestEmail() {
    showLoading('正在发送测试邮件...');
    
    try {
        const response = await fetch('/api/send-test-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('测试邮件发送成功');
        } else {
            showError('测试邮件发送失败: ' + result.message);
        }
    } catch (error) {
        console.error('发送测试邮件失败:', error);
        showError('发送测试邮件失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 显示加载提示
function showLoading(message) {
    const toast = document.getElementById('loading-toast');
    if (toast) {
        toast.querySelector('.toast-body').textContent = message;
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
}

// 隐藏加载提示
function hideLoading() {
    // 加载提示会自动隐藏
}

// 显示成功消息
function showSuccess(message) {
    showToast(message, 'success');
}

// 显示错误消息
function showError(message) {
    showToast(message, 'danger');
}

// 显示提示消息
function showToast(message, type = 'info') {
    // 创建toast元素
    const toastContainer = document.querySelector('.toast-container');
    const toastId = 'toast-' + Date.now();
    
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert">
            <div class="toast-header">
                <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-triangle' : 'info-circle'} text-${type} me-2"></i>
                <strong class="me-auto">系统提示</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElement);
    bsToast.show();
    
    // 自动移除toast元素
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// 域名管理相关函数
function showAddDomainModal() {
    // 清空输入框
    document.getElementById('new-domain').value = '';
    const modal = new bootstrap.Modal(document.getElementById('addDomainModal'));
    modal.show();
    
    // 聚焦到输入框
    setTimeout(() => {
        document.getElementById('new-domain').focus();
    }, 500);
}

// 处理添加域名表单提交
function handleAddDomainForm(event) {
    event.preventDefault();
    addDomain();
}

async function addDomain() {
    const domain = document.getElementById('new-domain').value.trim();
    if (!domain) {
        showError('请输入域名');
        return;
    }
    
    // 改进的域名格式验证
    const domainRegex = /^(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/;
    if (!domainRegex.test(domain)) {
        showError('请输入有效的域名格式，例如：example.com 或 subdomain.example.com');
        return;
    }
    
    // 额外验证：检查域名长度和特殊字符
    if (domain.length > 253) {
        showError('域名长度不能超过253个字符');
        return;
    }
    
    // 检查是否包含协议前缀
    if (domain.includes('://') || domain.includes('http://') || domain.includes('https://')) {
        showError('请输入域名，不要包含协议前缀（如 http:// 或 https://）');
        return;
    }
    
    // 检查是否包含端口号
    if (domain.includes(':')) {
        showError('请输入域名，不要包含端口号');
        return;
    }
    
    showLoading('正在添加域名...');
    
    try {
        // 获取当前配置
        const config = currentData.config;
        const currentDomains = config.domains || [];
        
        // 检查域名是否已存在
        if (currentDomains.includes(domain)) {
            showError('该域名已存在');
            return;
        }
        
        // 添加新域名
        const updatedDomains = [...currentDomains, domain];
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: updatedDomains,
                emailSettings: config.emailSettings,
                scheduleSettings: config.scheduleSettings
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`域名 ${domain} 添加成功`);
            // 自动刷新页面数据
            autoRefreshData();
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addDomainModal'));
            modal.hide();
        } else {
            showError(`域名 ${domain} 添加失败: ${result.message}`);
        }
    } catch (error) {
        console.error('添加域名失败:', error);
        showError(`域名 ${domain} 添加失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 刷新日志
function refreshLogs() {
    showSuccess('日志刷新功能待实现');
}

// 清空日志
function clearLogs() {
    const logsContent = document.getElementById('logs-content');
    if (logsContent) {
        logsContent.innerHTML = '<p class="text-muted">暂无日志</p>';
    }
    showSuccess('日志已清空');
}

// 邮件配置管理相关函数
function loadEmailConfigs() {
    const emailConfigList = document.getElementById('email-config-list');
    if (!emailConfigList || !currentData) return;
    
    const emailSettings = currentData.config.emailSettings;
    const emails = emailSettings.toEmails || [];
    
    let html = `
        <div class="card">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <strong>接收邮箱 (${emails.length} 个):</strong>
                        ${emails.length > 0 ? emails.join(', ') : '未设置'}
                    </div>
                    <div class="col-md-6">
                        <strong>预警天数:</strong> ${emailSettings.warningDays || 30} 天
                    </div>
                </div>
                ${emails.length > 0 ? `
                <div class="mt-3">
                    <h6>邮箱列表:</h6>
                    <div class="list-group">
                        ${emails.map(email => `
                            <div class="list-group-item d-flex justify-content-between align-items-center">
                                <span>${email}</span>
                                <button class="btn btn-sm btn-outline-danger" onclick="removeEmail('${email}')">
                                    <i class="bi bi-trash"></i> 删除
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    emailConfigList.innerHTML = html;
}

function showAddEmailModal() {
    // 清空输入框
    document.getElementById('new-email').value = '';
    document.getElementById('new-warning-days').value = '30';
    const modal = new bootstrap.Modal(document.getElementById('addEmailModal'));
    modal.show();
}

function handleAddEmailForm(event) {
    event.preventDefault();
    addEmailConfig();
}

function handleEmailFormSubmit(event) {
    event.preventDefault();
    updateEmailConfig();
}

async function updateEmailConfig() {
    const warningDays = parseInt(document.getElementById('warning-days').value);
    
    if (isNaN(warningDays) || warningDays < 1 || warningDays > 365) {
        showError('预警天数必须在1-365之间');
        return;
    }
    
    showLoading('正在更新邮件配置...');
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: {
                    toEmails: config.emailSettings.toEmails || [],
                    warningDays: warningDays
                },
                scheduleSettings: config.scheduleSettings
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('邮件配置更新成功');
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新邮件配置列表
            loadEmailConfigs();
        } else {
            showError('邮件配置更新失败: ' + result.message);
        }
    } catch (error) {
        console.error('更新邮件配置失败:', error);
        showError('邮件配置更新失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 添加邮箱
async function addEmail() {
    const email = document.getElementById('new-email-input').value.trim();
    
    if (!email) {
        showError('请输入邮箱地址');
        return;
    }
    
    if (!email.includes('@')) {
        showError('请输入有效的邮箱地址');
        return;
    }
    
    showLoading('正在添加邮箱...');
    
    try {
        const response = await fetch('/api/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`邮箱 ${email} 添加成功`);
            // 清空输入框
            document.getElementById('new-email-input').value = '';
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新邮件配置列表
            loadEmailConfigs();
        } else {
            showError(`邮箱 ${email} 添加失败: ${result.message}`);
        }
    } catch (error) {
        console.error('添加邮箱失败:', error);
        showError(`邮箱 ${email} 添加失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 删除邮箱
async function removeEmail(email) {
    if (!confirm(`确定要删除邮箱 ${email} 吗？`)) {
        return;
    }
    
    showLoading(`正在删除邮箱 ${email}...`);
    
    try {
        const response = await fetch(`/api/emails/${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`邮箱 ${email} 删除成功`);
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新邮件配置列表
            loadEmailConfigs();
        } else {
            showError(`邮箱 ${email} 删除失败: ${result.message}`);
        }
    } catch (error) {
        console.error('删除邮箱失败:', error);
        showError(`邮箱 ${email} 删除失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function addEmailConfig() {
    const email = document.getElementById('new-email').value.trim();
    const warningDays = parseInt(document.getElementById('new-warning-days').value);
    
    if (!email) {
        showError('请输入邮箱地址');
        return;
    }
    
    if (isNaN(warningDays) || warningDays < 1 || warningDays > 365) {
        showError('预警天数必须在1-365之间');
        return;
    }
    
    showLoading('正在添加邮件配置...');
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: {
                    toEmail: email,
                    warningDays: warningDays
                },
                scheduleSettings: config.scheduleSettings
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('邮件配置添加成功');
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新邮件配置列表
            loadEmailConfigs();
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addEmailModal'));
            modal.hide();
        } else {
            showError('邮件配置添加失败: ' + result.message);
        }
    } catch (error) {
        console.error('添加邮件配置失败:', error);
        showError('邮件配置添加失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

function editEmailConfig() {
    const emailSettings = currentData.config.emailSettings;
    document.getElementById('to-email').value = emailSettings.toEmail || '';
    document.getElementById('warning-days').value = emailSettings.warningDays || 30;
    
    // 滚动到表单
    document.getElementById('email-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteEmailConfig() {
    if (!confirm('确定要删除当前邮件配置吗？')) {
        return;
    }
    
    showLoading('正在删除邮件配置...');
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: {
                    toEmail: '',
                    warningDays: 30
                },
                scheduleSettings: config.scheduleSettings
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('邮件配置删除成功');
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新邮件配置列表
            loadEmailConfigs();
        } else {
            showError('邮件配置删除失败: ' + result.message);
        }
    } catch (error) {
        console.error('删除邮件配置失败:', error);
        showError('邮件配置删除失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 定时任务配置管理相关函数
function loadScheduleConfigs() {
    if (!currentData) return;
    
    const scheduleSettings = currentData.config.scheduleSettings;
    
    // 加载定时任务设置
    document.getElementById('schedule-enabled').checked = scheduleSettings.enabled || false;
    
    // 从cron表达式解析时间
    if (scheduleSettings.cronExpression) {
        const cronParts = scheduleSettings.cronExpression.split(' ');
        if (cronParts.length >= 2) {
            const hour = cronParts[1];
            const minute = cronParts[0];
            const timeString = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
            document.getElementById('schedule-time').value = timeString;
        }
    }
    
    document.getElementById('schedule-timezone').value = scheduleSettings.timezone || 'Asia/Shanghai';
    
    // 加载日报设置
    loadDailyReportSettings();
}

// 加载日报设置
function loadDailyReportSettings() {
    if (!currentData || !currentData.config.dailyReportSettings) return;
    
    const dailyReportSettings = currentData.config.dailyReportSettings;
    
    // 设置日报设置表单的值
    const enabledCheckbox = document.getElementById('dailyReportEnabled');
    const timeInput = document.getElementById('dailyReportTime');
    const timezoneSelect = document.getElementById('dailyReportTimezone');
    
    if (enabledCheckbox) {
        enabledCheckbox.checked = dailyReportSettings.enabled || false;
    }
    if (timeInput) {
        timeInput.value = dailyReportSettings.time || '08:00';
    }
    if (timezoneSelect) {
        timezoneSelect.value = dailyReportSettings.timezone || 'Asia/Shanghai';
    }
}

function showAddScheduleModal() {
    // 清空输入框
    document.getElementById('cron-expression').value = '0 9 * * *';
    document.getElementById('timezone').value = 'Asia/Shanghai';
    document.getElementById('schedule-enabled').checked = true;
    
    // 滚动到表单
    document.getElementById('schedule-form').scrollIntoView({ behavior: 'smooth' });
}

function handleScheduleFormSubmit(event) {
    event.preventDefault();
    updateScheduleConfig();
}

async function updateScheduleConfig() {
    const enabled = document.getElementById('schedule-enabled').checked;
    const cronExpression = document.getElementById('cron-expression').value.trim();
    const timezone = document.getElementById('timezone').value;
    
    if (!cronExpression) {
        showError('请输入Cron表达式');
        return;
    }
    
    showLoading('正在更新定时任务配置...');
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: config.emailSettings,
                scheduleSettings: {
                    enabled: enabled,
                    cronExpression: cronExpression,
                    timezone: timezone
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('定时任务配置更新成功');
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新定时任务配置列表
            loadScheduleConfigs();
        } else {
            showError('定时任务配置更新失败: ' + result.message);
        }
    } catch (error) {
        console.error('更新定时任务配置失败:', error);
        showError('定时任务配置更新失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

function editScheduleConfig() {
    if (!currentData) return;
    
    const scheduleSettings = currentData.config.scheduleSettings;
    
    // 填充当前配置到表单
    document.getElementById('schedule-enabled').checked = scheduleSettings.enabled || false;
    document.getElementById('cron-expression').value = scheduleSettings.cronExpression || '0 9 * * *';
    document.getElementById('timezone').value = scheduleSettings.timezone || 'Asia/Shanghai';
    
    // 显示编辑模态框
    const modal = new bootstrap.Modal(document.getElementById('editScheduleModal'));
    modal.show();
}

async function saveScheduleConfig() {
    const enabled = document.getElementById('schedule-enabled').checked;
    const cronExpression = document.getElementById('cron-expression').value;
    const timezone = document.getElementById('timezone').value;
    
    if (!cronExpression.trim()) {
        showError('请输入有效的Cron表达式');
        return;
    }
    
    showLoading('正在保存定时任务配置...');
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scheduleSettings: {
                    enabled: enabled,
                    cronExpression: cronExpression,
                    timezone: timezone
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('定时任务配置保存成功');
            // 关闭模态框
            const modal = bootstrap.Modal.getInstance(document.getElementById('editScheduleModal'));
            modal.hide();
            // 刷新页面数据
            autoRefreshData();
        } else {
            showError('保存失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存定时任务配置失败:', error);
        showError('保存失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function deleteScheduleConfig() {
    if (!confirm('确定要删除当前定时任务配置吗？')) {
        return;
    }
    
    showLoading('正在删除定时任务配置...');
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: config.emailSettings,
                scheduleSettings: {
                    enabled: false,
                    cronExpression: '0 9 * * *',
                    timezone: 'Asia/Shanghai'
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('定时任务配置删除成功');
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新定时任务配置列表
            loadScheduleConfigs();
        } else {
            showError('定时任务配置删除失败: ' + result.message);
        }
    } catch (error) {
        console.error('删除定时任务配置失败:', error);
        showError('定时任务配置删除失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function toggleSchedule() {
    const scheduleSettings = currentData.config.scheduleSettings;
    const newEnabled = !scheduleSettings.enabled;
    
    showLoading(`${newEnabled ? '启动' : '停止'}定时任务...`);
    
    try {
        const config = currentData.config;
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: config.domains,
                emailSettings: config.emailSettings,
                scheduleSettings: {
                    ...scheduleSettings,
                    enabled: newEnabled
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`定时任务${newEnabled ? '启动' : '停止'}成功`);
            // 重新加载系统数据
            loadSystemStatus();
            // 刷新定时任务配置列表
            loadScheduleConfigs();
        } else {
            showError(`定时任务${newEnabled ? '启动' : '停止'}失败: ${result.message}`);
        }
    } catch (error) {
        console.error('切换定时任务状态失败:', error);
        showError(`定时任务${newEnabled ? '启动' : '停止'}失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 详细检查结果相关函数
function showDetailedResults() {
    const modal = new bootstrap.Modal(document.getElementById('detailedResultsModal'));
    modal.show();
    loadDetailedResults();
}

function loadDetailedResults() {
    const content = document.getElementById('detailed-results-content');
    if (!content || !currentData) {
        content.innerHTML = '<p class="text-muted">暂无数据</p>';
        return;
    }
    
    if (!currentData.checkResults || !currentData.checkResults.results) {
        content.innerHTML = '<p class="text-muted">暂无检查结果</p>';
        return;
    }
    
    const results = currentData.checkResults.results;
    const warningDays = currentData.config.emailSettings.warningDays || 30;
    
    let html = `
        <div class="row mb-3">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h4>${results.length}</h4>
                        <small>总计检查</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h4>${currentData.checkResults.healthy || 0}</h4>
                        <small>正常证书</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-white">
                    <div class="card-body text-center">
                        <h4>${currentData.checkResults.expiring || 0}</h4>
                        <small>即将到期</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-danger text-white">
                    <div class="card-body text-center">
                        <h4>${currentData.checkResults.failed || 0}</h4>
                        <small>检查失败</small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>域名</th>
                        <th>状态</th>
                        <th>签发机构</th>
                        <th>到期时间</th>
                        <th>剩余天数</th>
                        <th>最后检查</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        let statusClass, statusText;
        
        if (result.status === 'success') {
            if (result.daysUntilExpiry <= 7) {
                statusClass = 'danger';
                statusText = '紧急';
            } else if (result.daysUntilExpiry <= warningDays) {
                statusClass = 'warning';
                statusText = '即将到期';
            } else {
                statusClass = 'success';
                statusText = '正常';
            }
        } else {
            statusClass = 'danger';
            statusText = '检查失败';
        }
        
        html += `
            <tr>
                <td><strong>${result.domain}</strong></td>
                <td><span class="badge bg-${statusClass}">${statusText}</span></td>
                <td>${result.issuer || '-'}</td>
                <td>${result.expiryDate || '-'}</td>
                <td>${result.daysUntilExpiry !== undefined ? result.daysUntilExpiry + ' 天' : '-'}</td>
                <td>${result.lastCheckTime || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${result.domain}')">
                        <i class="bi bi-arrow-clockwise"></i> 重新检查
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = html;
}

function refreshDetailedResults() {
    loadDetailedResults();
    showSuccess('详细结果已刷新');
}

// 检查状态管理
let checkingDomains = new Set();

// 自动刷新页面数据
function autoRefreshData() {
    console.log('自动刷新页面数据...');
    loadSystemStatus();
    loadSystemData();
}

// 执行证书检查
async function executeCertificateCheck() {
    try {
        showLoading('正在执行证书检查...');
        
        // 设置超时处理
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('证书检查超时')), 30000); // 30秒超时
        });
        
        const fetchPromise = fetch('/api/check-certificates', {
            method: 'POST'
        });
        
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        const result = await response.json();
        
        if (result.success) {
            // 更新当前数据
            currentData.checkResults = result.data;
            // 刷新页面显示
            loadDomainsTable();
            updateOverviewCards(currentData);
            showSuccess('证书检查完成');
        } else {
            console.error('证书检查失败:', result.message);
            // 不显示错误提示，避免影响用户体验
        }
    } catch (error) {
        console.error('执行证书检查失败:', error);
        // 不显示错误提示，避免影响用户体验
    } finally {
        hideLoading();
    }
}

// 更新单个域名的状态显示
function updateDomainStatus(domain, checkResult) {
    // 找到对应的表格行并更新状态
    const rows = document.querySelectorAll('#domains-table tbody tr');
    rows.forEach(row => {
        const domainCell = row.querySelector('td:first-child');
        if (domainCell && domainCell.textContent.trim() === domain) {
            // 更新状态列
            const statusCell = row.querySelector('td:nth-child(2)');
            const expiryCell = row.querySelector('td:nth-child(3)');
            const daysCell = row.querySelector('td:nth-child(4)');
            const checkTimeCell = row.querySelector('td:nth-child(5)');
            const actionCell = row.querySelector('td:nth-child(6)');
            
            if (checkResult.status === 'success') {
                const statusClass = checkResult.daysUntilExpiry <= 7 ? 'danger' : 
                                  checkResult.daysUntilExpiry <= 30 ? 'warning' : 'success';
                const statusText = checkResult.daysUntilExpiry <= 7 ? '紧急' : 
                                 checkResult.daysUntilExpiry <= 30 ? '即将到期' : '正常';
                
                statusCell.innerHTML = `<span class="badge bg-${statusClass}">${statusText}</span>`;
                expiryCell.textContent = checkResult.expiryDate;
                daysCell.textContent = `${checkResult.daysUntilExpiry} 天`;
                checkTimeCell.textContent = checkResult.lastCheckTime;
                actionCell.innerHTML = `
                    <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                        <i class="bi bi-arrow-clockwise"></i> 检查
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                        <i class="bi bi-trash"></i> 删除
                    </button>
                `;
            } else if (checkResult.status === 'cloudflare_protected') {
                statusCell.innerHTML = '<span class="badge bg-info">Cloudflare保护</span>';
                expiryCell.textContent = '-';
                daysCell.textContent = '-';
                checkTimeCell.textContent = checkResult.lastCheckTime;
                actionCell.innerHTML = `
                    <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                        <i class="bi bi-arrow-clockwise"></i> 重新检查
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                        <i class="bi bi-trash"></i> 删除
                    </button>
                `;
            } else {
                statusCell.innerHTML = '<span class="badge bg-danger">检查失败</span>';
                expiryCell.textContent = '-';
                daysCell.textContent = '-';
                checkTimeCell.textContent = checkResult.lastCheckTime;
                actionCell.innerHTML = `
                    <button class="btn btn-sm btn-outline-primary" onclick="checkSingleDomain('${domain}')">
                        <i class="bi bi-arrow-clockwise"></i> 重新检查
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeDomain('${domain}')">
                        <i class="bi bi-trash"></i> 删除
                    </button>
                `;
            }
        }
    });
}

// 检查单个域名
async function checkSingleDomain(domain) {
    // 防止重复检查
    if (checkingDomains.has(domain)) {
        showWarning(`域名 ${domain} 正在检查中，请稍候...`);
        return;
    }
    
    checkingDomains.add(domain);
    showLoading(`正在检查域名 ${domain}...`);
    
    try {
        const response = await fetch(`/api/certificate/${encodeURIComponent(domain)}`);
        const result = await response.json();
        
        if (result.success) {
            // 更新当前数据中的检查结果
            if (!currentData.checkResults) {
                currentData.checkResults = { results: [] };
            }
            
            // 更新或添加该域名的检查结果
            const existingIndex = currentData.checkResults.results.findIndex(r => r.domain === domain);
            const checkResult = {
                ...result.data,
                lastCheckTime: new Date().toLocaleString()
            };
            
            if (existingIndex >= 0) {
                currentData.checkResults.results[existingIndex] = checkResult;
            } else {
                currentData.checkResults.results.push(checkResult);
            }
            
            // 重新计算统计数据
            updateCheckResultsStats();
            
            // 更新概况页面
            updateRecentCheckResults(currentData.checkResults);
            
            showSuccess(`域名 ${domain} 检查完成`);
            // 只刷新当前域名的状态，不重新生成整个表格
            updateDomainStatus(domain, checkResult);
        } else {
            showError(`域名 ${domain} 检查失败: ${result.message}`);
        }
    } catch (error) {
        console.error('检查单个域名失败:', error);
        showError(`域名 ${domain} 检查失败: ${error.message}`);
    } finally {
        checkingDomains.delete(domain);
        hideLoading();
    }
}

// 删除域名
async function removeDomain(domain) {
    if (!confirm(`确定要删除域名 ${domain} 吗？`)) {
        return;
    }
    
    showLoading(`正在删除域名 ${domain}...`);
    
    try {
        // 获取当前配置
        const config = currentData.config;
        const updatedDomains = config.domains.filter(d => d !== domain);
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domains: updatedDomains,
                emailSettings: config.emailSettings,
                scheduleSettings: config.scheduleSettings
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`域名 ${domain} 删除成功`);
            // 自动刷新页面数据
            autoRefreshData();
        } else {
            showError(`域名 ${domain} 删除失败: ${result.message}`);
        }
    } catch (error) {
        console.error('删除域名失败:', error);
        showError(`域名 ${domain} 删除失败: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// 保存日报设置
async function saveDailyReportSettings() {
    const enabled = document.getElementById('dailyReportEnabled').checked;
    const time = document.getElementById('dailyReportTime').value;
    const timezone = document.getElementById('dailyReportTimezone').value;
    
    try {
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dailyReportSettings: {
                    enabled: enabled,
                    time: time,
                    timezone: timezone
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('日报设置保存成功');
            loadScheduleConfigs(); // 重新加载配置
        } else {
            showError('保存日报设置失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存日报设置失败:', error);
        showError('保存日报设置失败: ' + error.message);
    }
}

// 测试日报
async function testDailyReport() {
    try {
        showLoading('正在发送测试日报...');
        
        const response = await fetch('/api/daily-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('测试日报发送成功');
        } else {
            showError('测试日报发送失败: ' + result.message);
        }
    } catch (error) {
        console.error('测试日报失败:', error);
        showError('测试日报失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 保存SMTP配置
async function saveSmtpConfig() {
    const smtpConfig = {
        host: document.getElementById('smtp-host').value,
        port: parseInt(document.getElementById('smtp-port').value),
        user: document.getElementById('smtp-user').value,
        pass: document.getElementById('smtp-pass').value,
        from: document.getElementById('smtp-from').value,
        secure: document.getElementById('smtp-secure').value === 'true'
    };
    
    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.user || !smtpConfig.pass || !smtpConfig.from) {
        showError('请填写完整的SMTP配置信息');
        return;
    }
    
    try {
        showLoading('正在保存SMTP配置...');
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                smtpConfig: smtpConfig
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('SMTP配置保存成功');
            loadEmailConfigs(); // 重新加载配置
        } else {
            showError('保存SMTP配置失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存SMTP配置失败:', error);
        showError('保存SMTP配置失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 测试SMTP连接
async function testSmtpConnection() {
    try {
        showLoading('正在测试SMTP连接...');
        
        const response = await fetch('/api/verify-email-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('SMTP连接测试成功');
        } else {
            showError('SMTP连接测试失败: ' + result.message);
        }
    } catch (error) {
        console.error('测试SMTP连接失败:', error);
        showError('测试SMTP连接失败: ' + error.message);
    } finally {
        hideLoading();
    }
}

// 处理定时任务表单提交
async function handleScheduleFormSubmit(event) {
    event.preventDefault();
    
    const enabled = document.getElementById('schedule-enabled').checked;
    const time = document.getElementById('schedule-time').value;
    const timezone = document.getElementById('schedule-timezone').value;
    
    // 将时间转换为cron表达式
    const [hour, minute] = time.split(':');
    const cronExpression = `${minute} ${hour} * * *`;
    
    try {
        showLoading('正在保存定时任务设置...');
        
        const response = await fetch('/api/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scheduleSettings: {
                    enabled: enabled,
                    cronExpression: cronExpression,
                    timezone: timezone
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('定时任务设置保存成功');
            loadSystemStatus(); // 重新加载系统状态
        } else {
            showError('保存定时任务设置失败: ' + result.message);
        }
    } catch (error) {
        console.error('保存定时任务设置失败:', error);
        showError('保存定时任务设置失败: ' + error.message);
    } finally {
        hideLoading();
    }
}
