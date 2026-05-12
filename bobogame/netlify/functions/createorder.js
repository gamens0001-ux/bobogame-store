const crypto = require('crypto');

exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const payload = JSON.parse(event.body);
        
        const MerchantID = process.env.ECPAY_MERCHANT_ID;
        const HashKey = process.env.ECPAY_HASH_KEY;
        const HashIV = process.env.ECPAY_HASH_IV;

        if (!MerchantID || !HashKey || !HashIV) {
            throw new Error("伺服器遺失綠界金鑰，請檢查 Netlify 環境變數設定！");
        }

        // --- 🛠️ 關鍵修復：手動組合台灣時間，強制補 0 確保符合 YYYY/MM/DD HH:mm:ss ---
        const now = new Date();
        const tzOffset = 8 * 60 * 60 * 1000; // 台灣時間 UTC+8
        const twTime = new Date(now.getTime() + tzOffset);
        
        const yyyy = twTime.getUTCFullYear();
        const mm = String(twTime.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(twTime.getUTCDate()).padStart(2, '0');
        const hh = String(twTime.getUTCHours()).padStart(2, '0');
        const min = String(twTime.getUTCMinutes()).padStart(2, '0');
        const ss = String(twTime.getUTCSeconds()).padStart(2, '0');
        const formattedDate = `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;

        // 2. 準備綠界需要的必填參數
        const baseParams = {
            MerchantID: MerchantID,
            MerchantTradeNo: payload.MerchantTradeNo, 
            MerchantTradeDate: formattedDate, // <--- 改用這個保證不會錯的時間格式
            PaymentType: 'aio',
            TotalAmount: payload.TotalAmount.toString(),
            TradeDesc: '波波電玩商城訂單',
            ItemName: payload.ItemName,
            ReturnURL: 'https://www.ecpay.com.tw/receive.php',
            ChoosePayment: 'ALL',
            EncryptType: '1',
            OrderResultURL: payload.ClientBackURL, 
            NeedExtraPaidInfo: 'N',
            DeviceSource: 'P',
            InvoiceMark: 'N',
        };

        // 3. 綠界核心加密：排序參數並計算 CheckMacValue
        const sortedKeys = Object.keys(baseParams).sort();
        let rawStr = `HashKey=${HashKey}&` + sortedKeys.map(key => `${key}=${baseParams[key]}`).join('&') + `&HashIV=${HashIV}`;
        
        rawStr = encodeURIComponent(rawStr).replace(/%20/g, '+').toLowerCase()
            .replace(/%2d/g, '-')
            .replace(/%5f/g, '_')
            .replace(/%2e/g, '.')
            .replace(/%21/g, '!')
            .replace(/%2a/g, '*')
            .replace(/%28/g, '(')
            .replace(/%29/g, ')');

        const CheckMacValue = crypto.createHash('sha256').update(rawStr).digest('hex').toUpperCase();

        // 4. 產生自動送出的 HTML 表單
        const htmlForm = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>轉跳中...</title></head>
            <body style="text-align:center; padding-top:50px; font-family:sans-serif;">
                <h3>連線至綠界科技安全付款環境中...請勿關閉視窗</h3>
                <form id="_ecpayForm" method="POST" action="https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5">
                    ${Object.keys(baseParams).map(key => `<input type="hidden" name="${key}" value="${baseParams[key]}" />`).join('')}
                    <input type="hidden" name="CheckMacValue" value="${CheckMacValue}" />
                </form>
                <script>document.getElementById('_ecpayForm').submit();</script>
            </body>
            </html>
        `;

        return {
            statusCode: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
            body: htmlForm
        };

    } catch (error) {
        return { statusCode: 500, body: `<h1>伺服器錯誤</h1><p>${error.message}</p>` };
    }
};
