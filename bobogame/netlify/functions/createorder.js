const crypto = require('crypto');

exports.handler = async function(event, context) {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const payload = JSON.parse(event.body);
        
        // 1. 讀取你在 Netlify 設定好的環境變數
        const MerchantID = process.env.ECPAY_MERCHANT_ID;
        const HashKey = process.env.ECPAY_HASH_KEY;
        const HashIV = process.env.ECPAY_HASH_IV;

        if (!MerchantID || !HashKey || !HashIV) {
            throw new Error("伺服器遺失綠界金鑰，請檢查 Netlify 環境變數設定！");
        }

        // 2. 準備綠界需要的必填參數
        const baseParams = {
            MerchantID: MerchantID,
            MerchantTradeNo: payload.MerchantTradeNo, 
            MerchantTradeDate: new Date().toLocaleString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' }).replace(/\//g, '/'),
            PaymentType: 'aio',
            TotalAmount: payload.TotalAmount.toString(),
            TradeDesc: '波波電玩商城訂單',
            ItemName: payload.ItemName,
            ReturnURL: 'https://www.ecpay.com.tw/receive.php', // 測試環境用這組即可
            ChoosePayment: 'ALL',
            EncryptType: '1',
            OrderResultURL: payload.ClientBackURL, // 刷卡完跳轉回你的官網
            NeedExtraPaidInfo: 'N',
            DeviceSource: 'P',
            InvoiceMark: 'N',
        };

        // 3. 綠界核心加密：排序參數並計算 CheckMacValue
        const sortedKeys = Object.keys(baseParams).sort();
        let rawStr = `HashKey=${HashKey}&` + sortedKeys.map(key => `${key}=${baseParams[key]}`).join('&') + `&HashIV=${HashIV}`;
        
        // URL 編碼並轉換 (符合綠界嚴格規範)
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

        // 5. 將 HTML 回傳給前端
        return {
            statusCode: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" }, // 這次是回傳 HTML
            body: htmlForm
        };

    } catch (error) {
        return { statusCode: 500, body: `<h1>伺服器錯誤</h1><p>${error.message}</p>` };
    }
};
