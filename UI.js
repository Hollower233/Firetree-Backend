function clear_page() {
    document.body.style.background = '#000000';
    document.body.innerHTML = ''; // 或者只隐藏而不是清空
}
clear_page()
const windowDiv = document.createElement('div');
windowDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;             /* 宽度不变 */
    height: 500px;            /* 新增高度，变高一点，形成竖向长条 */
    background: #1e1e1e;
    border: 1px solid #333;
    z-index: 10000;
    padding: 10px;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    font-family: Arial, sans-serif;
    color: #ffffff;
    overflow: auto;           /* 可选：内容过多时自动滚动 */
`;

// 创建导航栏
const nav = document.createElement('div');
nav.style.cssText = `
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    border-bottom: 1px solid #333;
    padding-bottom: 5px;
`;

function createNavLink(text) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = text;
    link.style.cssText = `
        cursor: pointer;
        text-decoration: none;
        color: #00afff;
        transition: color 0.2s;
    `;
    link.addEventListener('hover', () => {
        link.style.color = '#00ddff';
    });
    return link;
}

const homeLink = createNavLink('主页');
const settingsLink = createNavLink('设置');
const auditLink = createNavLink("下载审计表")


nav.appendChild(homeLink);
nav.appendChild(settingsLink);
nav.appendChild(auditLink)
windowDiv.appendChild(nav);

// 创建内容容器
const contentDiv = document.createElement('div');

function createHomeContent() {
    const element = document.createElement('div');
    const inputs = {};
    const buttons = {};
    const status = document.createElement('pre');

    // 收款人输入框
    inputs.recipient = createInput('收款人', 'text');
    element.appendChild(inputs.recipient);

    // Robux数量输入框
    inputs.robux = createInput('Robux数量', 'number', '0');
    element.appendChild(inputs.robux);

    // 人民币收款输入框
    inputs.rmb = createInput('人民币收款￥', 'number', '0');
    element.appendChild(inputs.rmb);

    // 发送按钮
    buttons.send = createButton('发送Robux');
    buttons.send.disabled = true;
    element.appendChild(buttons.send);

    // 状态输出区
    status.style.cssText = `
        position: absolute;
        left: 10px;
        right: 9px;
        top: 236px;              /* 根据你上面的内容调整 */
        bottom: 10px;
        overflow-y: auto;
        background: #2a2a2a;
        padding: 5px;
        white-space: pre-wrap;
        font-size: 0.9em;
        color: #00ffaa;
        border: 1px solid #444;
    `;
    element.appendChild(status);

    return { element, inputs, buttons, status };
}

// 主页内容
const homeContent = createHomeContent();
const recipientInput = homeContent.inputs.recipient;
const robuxInput = homeContent.inputs.robux;
const rmbInput = homeContent.inputs.rmb
const sendButton = homeContent.buttons.send;
const statusOutput = homeContent.status;

function createSettingsContent() {
    const element = document.createElement('div');
    const inputs = {};
    const buttons = {};
    const status = document.createElement('div');

    // 密码框
    inputs.password = createInput('2FA密码', 'password');
    element.appendChild(inputs.password);
    // 群组ID
    inputs.group_id = createInput('群组ID', 'text');
    element.appendChild(inputs.group_id);

    // Notion API Key（隐藏输入）
    inputs.notion_api_key = createInput('Notion API Key', 'password');
    element.appendChild(inputs.notion_api_key);

    // Notion Database ID
    inputs.notion_database_id = createInput('Notion Database ID', 'text');
    element.appendChild(inputs.notion_database_id);
    // 保存按钮
    buttons.save = createButton('保存');
    element.appendChild(buttons.save);

    // 状态提示
    status.style.cssText = `
        margin-top: 10px;
        height: 20px;
        font-size: 0.9em;
        color: #00ffaa;
    `;
    element.appendChild(status);

    return { element, inputs, buttons, status };
}
// 设置内容
const settingsContent = createSettingsContent();

// 默认显示主页
contentDiv.appendChild(homeContent.element);
contentDiv.appendChild(settingsContent.element);
settingsContent.element.style.display = 'none';
windowDiv.appendChild(contentDiv);
document.body.appendChild(windowDiv);

// 切换页面逻辑
let currentPage = 'home';
homeLink.addEventListener('click', () => switchPage('home'));
settingsLink.addEventListener('click', () => switchPage('settings'));
auditLink.addEventListener("click", fetchAllSpendGroupFundsLogs)
function switchPage(page) {
    if (currentPage === page) return;
    currentPage = page;
    homeContent.element.style.display = page === 'home' ? 'block' : 'none';
    settingsContent.element.style.display = page === 'settings' ? 'block' : 'none';
}

// 输入验证
function is_input_valid(){
    return recipientInput.value.trim() && robuxInput.value && rmbInput.value
}
function clear_inputs() {
    recipientInput.value = ''
    robuxInput.value = ''
    rmbInput.value = ''
}
function checkInputs() {
    sendButton.disabled = ! is_input_valid()
}
recipientInput.addEventListener('input', checkInputs);
robuxInput.addEventListener('input', checkInputs);
rmbInput.addEventListener('input', checkInputs)
// 发送按钮事件
sendButton.addEventListener('click', () => {
    if (!is_input_valid()) return
    const recipient = recipientInput.value.trim();
    const robux = robuxInput.value;
    const rmb = rmbInput.value
    localStorage.setItem("payout_username", recipient)
    localStorage.setItem("payout_amount", robux)
    localStorage.setItem("rmb", rmb)
    do_payout()
    clear_inputs()
    checkInputs();
});

// 保存设置
settingsContent.buttons.save.addEventListener('click', () => {
    const password = settingsContent.inputs.password.value.trim();
    const group_id = settingsContent.inputs.group_id.value.trim();
    const notion_api_key = settingsContent.inputs.notion_api_key.value.trim();
    const notion_database_id = settingsContent.inputs.notion_database_id.value.trim();

    if (!password) {
        showSettingsStatus('请输入2FA密码', settingsContent.status);
        return;
    }

    localStorage.setItem('2fa', password);
    localStorage.setItem('group_id', group_id);
    localStorage.setItem('notion_api_key', notion_api_key);
    localStorage.setItem('notion_database_id', notion_database_id);

    showSettingsStatus('设置已保存', settingsContent.status);
});

// 辅助函数






function createInput(placeholder, type, min = '') {
    const input = document.createElement('input');
    input.placeholder = placeholder;
    input.type = type;
    if (min) input.min = min;
    input.style.cssText = `
        display: block;
        width: 100%;
        margin-bottom: 5px;
        padding: 10px;
        font-size: 1em;
        background: #2d2d2d;
        border: 1px solid #444;
        color: #ffffff;
        border-radius: 3px;
    `;
    return input;
}

function createButton(text) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
        width: 100%;
        padding: 5px;
        font-size: 1em;
        cursor: pointer;
        background: #0078d4;
        color: white;
        border: none;
        border-radius: 3px;
        margin-top: 5px;
        transition: background 0.2s;
    `;
    button.addEventListener('mouseenter', () => {
        button.style.background = '#0099ff';
    });
    button.addEventListener('mouseleave', () => {
        button.style.background = '#0078d4';
    });
    return button;
}

function addToStatus(message, outputElement) {
    const timestamp = new Date().toLocaleTimeString();
    const line = `[${timestamp}] ${message}\n`;
    outputElement.textContent += line;
    
    // 限制显示20行
    const lines = outputElement.textContent.split('\n');
    if (lines.length > 20) {
        outputElement.textContent = lines.slice(-20).join('\n');
    }
    
    outputElement.scrollTop = outputElement.scrollHeight;
}

function showSettingsStatus(message, statusElement) {
    statusElement.textContent = message;
    setTimeout(() => statusElement.textContent = '', 3000);
}