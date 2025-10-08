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

function getHumidityForTemperature(temp) {
    // base value: inversely related to temperature
    let base = 80 - (temp - 22) * 1.5; // as temp rises from 22→30, humidity drops ~12%

    // add small random fluctuation
    const delta = Math.random() * 4 - 2; // ±2%

    lastHumidity = Math.min(90, Math.max(30, base + delta));
    return Math.round(lastHumidity);
}

function getAirPressureForTemperature(temp) {
    // small negative correlation (optional)
    let base = 1015 - (temp - 22) * 0.5; // small drop as temp rises

    // add small random fluctuation
    const delta = Math.random() * 2 - 1; // ±1 hPa
    lastAirPressure = Math.min(1050, Math.max(950, base + delta));
    return Math.round(lastAirPressure);
}

app.post("/data", async (req, res) => {
    try {
        const { topicId, ADC, temperature } = req.body;

        //create random humidity
        const humidity = getHumidityForTemperature(temperature);

        // create random air pressure between 950 and 1050
        const airPressure = getAirPressureForTemperature(temperature);

        const message = JSON.stringify({ ADC, temperature, humidity, airPressure, timestamp: Date.now() });

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
