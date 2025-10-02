// script.js
const express = require("express");
const bodyParser = require("body-parser");
const { Client, TopicMessageSubmitTransaction, PrivateKey } = require("@hashgraph/sdk");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

// 🔑 Load credentials from environment variables
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);
const topicId = process.env.HEDERA_TOPIC_ID;

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

app.post("/data", async (req, res) => {
    try {
        const { temperature, humidity } = req.body;
        const message = JSON.stringify({ temperature, humidity, timestamp: Date.now() });

        const tx = await new TopicMessageSubmitTransaction({
            topicId,
            message,
        }).execute(client);

        res.json({ status: "ok", sent: message, txId: tx.transactionId.toString() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
