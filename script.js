// script.js

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client, TopicMessageSubmitTransaction, PrivateKey } = require("@hashgraph/sdk");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 🔑 Load credentials from environment variables
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

const settings = {
    "0.0.6963500": { interval: 30000 },
};

app.post("/data", async (req, res) => {
    try {
        const { topicId, temperature, humidity, pressure } = req.body;

        const message = JSON.stringify({ temperature, humidity, airPressure: pressure, timestamp: Date.now() });

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

app.post("/settings/:topicId", (req, res) => {
    const topicId = req.params.topicId;
    const { interval } = req.body;

    if (interval < 1000) {
        return res.status(400).json({ error: "Interval must be greater than 1000 ms (1 second)" });
    }

    settings[topicId]["interval"] = interval;
    res.json({ status: "ok", received: { interval } });
});

app.get("/settings/:topicId", (req, res) => {
    const id = req.params.topicId;
    if (settings[id]) {
        res.json(settings[id]);
    } else {
        res.status(404).json({ error: "Sensor not found" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
