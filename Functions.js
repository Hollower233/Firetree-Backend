function clear_page() {
    document.body.style.background = '#000000';
    document.body.innerHTML = ''; // 或者只隐藏而不是清空
}
function getCookie(name, domain) {
    return new Promise((resolve, reject) => {
        GM_cookie.list({ name, domain }, function (cookies, error) {
            if (error) return reject(error);
            resolve(cookies && cookies.length > 0 ? cookies[0] : null);
        });
    });
}

async function get_security_cookie(){
    log("🍪正在获取Cookie", "waiting")
    const cookie = await getCookie(".ROBLOSECURITY", ".roblox.com");
    if (!cookie){
        throw_error("🍪Cookie没找到！")
    }
    log("🍪Cookie获取成功", "success")
    return cookie.value
}
function getErrorMessage(messageJson) {
    return (messageJson.errors && messageJson.errors[0] && messageJson.errors[0].message)
        || "success";
}
function parseHeaders(headerStr) {
    const headers = {};
    if (!headerStr) return headers;

    const lines = headerStr.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [key, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        headers[key.trim()] = value;
    }
    return headers;
}
function notion_field(type, value) {
    switch (type) {
        case 'title':
            return {
                title: [{
                    text: { content: value }
                }]
            };
        case 'text':
        case 'rich_text':
            return {
                rich_text: [{
                    text: { content: value }
                }]
            };
        case 'number':
            return { number: Number(value) };
        case 'date':
            return { date: { start: value } };
        case 'select':
            return { select: { name: value } };
        case 'checkbox':
            return { checkbox: Boolean(value) };
        default:
            throw new Error(`Unsupported field type: ${type}`);
    }
}
async function log_to_google_sheet(payout_info) {
    const link = "https://api.notion.com/v1/pages"
    const notion_api_key = "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"
    const notion_database_id = "20aefc53b30e80f48024de211d7d89ab"
    log("📈正在记账", "waiting")
    const response = await send_request(link, {
        'Authorization': `Bearer ${notion_api_key}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
    }, {
        parent: {
            database_id: notion_database_id
        },
        properties: {
            "玩家名": notion_field('title', payout_info.user_name),
            "Robux数量": notion_field('number', payout_info.robux_amount),
            "人民币收款": notion_field('number', payout_info.rmb),
            "玩家ID": notion_field('number', payout_info.user_id),
            "交易时间": notion_field('date', new Date().toISOString()),
        }
    })
    if(response.status_code == 200){
        log(`📈${payout_info.user_name}花了${payout_info.rmb}￥买了${payout_info.robux_amount}R$`, "success")
    }
    else{
        throw_error("📈记账失败了!")
    }
}
function parse_response_text_to_json(responseText){
    try {
        return JSON.parse(responseText)
    } catch (error) {
        return {}
    }
}
function send_request(link, headers, jsonData, method) {
    const json_string = JSON.stringify(jsonData);

    console.warn(link, {
        headers: headers,
        json: jsonData,
    }, "[POST Request]");

    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: method || 'POST',
            url: link,
            headers: headers,
            data: json_string,
            onload: function(response) {
                const rawText = response.responseText?.trim();  // 防止 undefined/null
                const resultJson = parse_response_text_to_json(response.responseText)
                const error_message = getErrorMessage(resultJson);

                const result = {
                    status_code: response.status,
                    json: resultJson,
                    error_message: error_message,
                    headers: parseHeaders(response.responseHeaders)
                };
                console.warn(link, error_message, "[POST Response]");
                resolve(result); // 成功时 resolve

            },
        });
    });
}
function getCookieHeaders(securityCookie) {
    return {
        'Cookie': '.ROBLOSECURITY=' + securityCookie
    };
}
async function get_csrf_headers(cookie_headers) {
    log("🔒正在获取CSRF", "waiting")
    const result = await send_request("https://auth.roblox.com/v2/logout", cookie_headers, {})
    log("🔑CSRF获取成功", "success")
    const csrf_headers = {... cookie_headers}
    csrf_headers['Content-Type'] = 'application/json'
    csrf_headers["X-CSRF-TOKEN"] = result.headers["x-csrf-token"]
    return csrf_headers
}
async function send_payout_request(headers, payout_info){
    const link = "https://groups.roblox.com/v1/groups/"  + payout_info.group_id + "/payouts"
    return await send_request(link, headers, {
        "PayoutType": "FixedAmount",
        "Recipients": [
            {
                "amount": payout_info.robux_amount,
                "recipientId": payout_info.user_id,
                "recipientType": "User"
            }
        ]
    })
}
function throw_error(message){
    log(message, "failed")
    alert(message)
    throw new Error(message)
}

async function try_payout(headers, payout_info) {
    log("💸尝试支付", "waiting")
    const payout_request_result = await send_payout_request(headers, payout_info)
    const is_success = payout_request_result.status_code == 200
    if(is_success){
        log(`💎成功向${payout_info.user_name}发送了 ${payout_info.robux_amount} R💲`, "success")
        log_to_google_sheet(payout_info)
    }
    if(payout_request_result.error_message == "The recipients are invalid."){
        throw_error(`💸${payout_info.user_name}没达到转账条件`)
    }
    return [is_success, payout_request_result]
}
function get_challenge_info(payout_request_headers){

    const encoded_meta_data = payout_request_headers["rblx-challenge-metadata"]
    const decoded_json_string = atob(encoded_meta_data)
    const meta_data_json = JSON.parse(decoded_json_string)

    return {
        "challenge_id" : payout_request_headers["rblx-challenge-id"],
        "sender_id": meta_data_json["userId"],
        "meta_data_challenge_id" : meta_data_json["challengeId"],
    }
}
function getTOTP(secret_2fa) {
    return otplib.authenticator.generate(secret_2fa)
}
async function request_verify_token(csrf_headers, secret_2fa, challenge_info) {
    const code = getTOTP(secret_2fa)
    const link = "https://twostepverification.roblox.com/v1/users/" + challenge_info.sender_id + "/challenges/authenticator/verify"
    log("🔒正在获取验证Token", "waiting")
    const result = await send_request(link, csrf_headers, {
        "actionType": "Generic",
        "challengeId": challenge_info.meta_data_challenge_id,
        "code": code
    })
    log("🔑验证token获取成功", "success")
    return result.json["verificationToken"]
}
async function request_continue_payout(csrf_headers, challenge_info, verify_token) {
    log("➡️正在请求Roblox继续", "waiting")
    await send_request("https://apis.roblox.com/challenge/v1/continue", csrf_headers, {
        "challengeId": challenge_info.challenge_id,
        "challengeMetadata": JSON.stringify({
            "rememberDevice": false,
            "actionType": "Generic",
            "verificationToken": verify_token,
            "challengeId": challenge_info.meta_data_challenge_id
        }),
        "challengeType": "twostepverification",
    })
    log("➡️Roblox同意继续", "success")
}
function get_final_request_headers(csrf_headers, challenge_info, verify_token){
    const final_request_headers = {... csrf_headers}
    final_request_headers['rblx-challenge-id'] = challenge_info.challenge_id
    const meta_data = {
        "rememberDevice": false,
        "actionType": "Generic",
        "verificationToken": verify_token,
        "challengeId": challenge_info.meta_data_challenge_id
    } 
    const jsonStr = JSON.stringify(meta_data);
    // 使用 encodeURIComponent + unescape 来正确处理 UTF-8 字符
    const encodedStr = unescape(encodeURIComponent(jsonStr));
    const base64Str = btoa(encodedStr);
    final_request_headers['rblx-challenge-metadata'] = base64Str
    final_request_headers['rblx-challenge-type'] = "twostepverification"
    return final_request_headers
}
async function get_user_id(username) {
    const url = 'https://users.roblox.com/v1/usernames/users'; 
    const body = {
        usernames: [username],
        excludeBannedUsers: true
    };
    log("🃏正在获取" + username + "的ID", "waiting")
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    const user_id = data.data?.[0]?.id || null
    if(!user_id){
        throw_error("🃏ID获取失败！")
    }
    log(`🃏ID为${user_id}`, "success")
    return user_id;
}
async function get_payout_info() {
    const security_cookie = await get_security_cookie()
    const secret_2fa = localStorage.getItem("2fa")
    if (!secret_2fa){
        alert("2fa没设置")
        throw new Error("2fa没设置");
        return
    }
    const username = localStorage.getItem("payout_username")
    const user_id = await get_user_id(username)
    return {
        "security_cookie" : security_cookie,
        "secret_2fa": secret_2fa,
        "group_id": group_id,
        "user_id": user_id,
        "robux_amount": localStorage.getItem("payout_amount"),
        "user_name" : username,
        "rmb" : localStorage.getItem("rmb"),
    }
}
async function do_payout() {
    const payout_info = await get_payout_info()
    const cookie_headers = getCookieHeaders(payout_info.security_cookie)
    const csrf_headers = await get_csrf_headers(cookie_headers)
    const [is_payout_success, payout_request_result] = await try_payout(csrf_headers, payout_info)
    if(is_payout_success)return
    log("💸支付失败！尝试二步验证", "failed")
    const challenge_info = get_challenge_info(payout_request_result.headers)
    const verify_token = await request_verify_token(csrf_headers, payout_info.secret_2fa, challenge_info)
    await request_continue_payout(csrf_headers, challenge_info, verify_token)
    const final_request_headers = get_final_request_headers(csrf_headers, challenge_info, verify_token)
    await try_payout(final_request_headers, payout_info)   
}
function log(message, state) {
    if(state == "waiting"){
        message += "⌛"
    }
    if(state == "success"){
        message += "✅"
    }
    if(state == "failed"){
        message += "❌"
    }
    addToStatus(message, statusOutput);
}

async function fetchAllSpendGroupFundsLogs() {
        const baseUrl = `https://groups.roblox.com/v1/groups/${groupId}/audit-log`; 
        const actionType = 'spendGroupFunds';
        const limit = 100;
        const sortOrder = 'Asc'; // 或 Desc，根据你的需求

        let allData = [];
        let cursor = null;
        let index = 0
        const securityCookie = await get_security_cookie();
        const cookieHeaders = getCookieHeaders(securityCookie);
        // const csrfHeaders = await get_csrf_headers(cookieHeaders);
        do {
            index += 1
            let url = `${baseUrl}?actionType=${actionType}&limit=${limit}&sortOrder=${sortOrder}`;
            if (cursor) {
                url += `&cursor=${encodeURIComponent(cursor)}`;
            }
            log(`🕵正在下载审计表${index}`, "waiting")
            const response = await send_request(url, cookieHeaders, {}, "GET")
            log(`🕵审计表${index}已下载`, "success")
            if (response.data && Array.isArray(response.data)) {
                allData = allData.concat(response.data);
            }

            cursor = response.nextPageCursor;
        } while (cursor !== null && cursor !== undefined);
        log(`🕵共获取到${allData.length}条记录`, "success")
        console.table(allData); // 可视化输出表格
    }