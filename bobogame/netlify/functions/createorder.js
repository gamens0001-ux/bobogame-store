// netlify/functions/createOrder.js

exports.handler = async function(event, context) {
    // 檢查是不是 POST 請求
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        // 解析前端傳來的訂單資料
        const orderData = JSON.parse(event.body);
        
        console.log("收到前端傳來的訂單：", orderData);

        // 在這裡，我們之後會加入綠界加密的邏輯
        // 現在先回傳一個成功的訊息給前端

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "後端已成功收到訂單！",
                receivedOrderNo: orderData.MerchantTradeNo,
                total: orderData.TotalAmount
            })
        };

    } catch (error) {
        console.error("處理訂單時發生錯誤：", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "伺服器內部錯誤" })
        };
    }
};