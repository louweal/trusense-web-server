// script.js
const sgMail = require("@sendgrid/mail");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client, TopicMessageSubmitTransaction, PrivateKey } = require("@hashgraph/sdk");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 🔑 Load credentials from environment variables
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

const settings = {};

const deviceSettings = {
    "0.0.7001056": {
        interval: 30000,
    },
};

const units = {
    Temperature: "°C",
    Humidity: "%",
    "Air Pressure": "hPa",
};

app.post("/data", async (req, res) => {
    try {
        const { topicId, temperature, humidity, pressure } = req.body;

        const msg = { temperature, humidity, airPressure: pressure, timestamp: Date.now() };

        const message = JSON.stringify(msg);

        if (settings[topicId]) {
            const minTemperature = settings[topicId]["minTemperature"] || -9999;
            const maxTemperature = settings[topicId]["maxTemperature"] || 9999;
            const minHumidity = settings[topicId]["minHumidity"] || -9999;
            const maxHumidity = settings[topicId]["maxHumidity"] || 9999;
            const minPressure = settings[topicId]["minPressure"] || -9999;
            const maxPressure = settings[topicId]["maxPressure"] || 9999;

            if (temperature < minTemperature || temperature > maxTemperature) {
                sendEmail(topicId, "Temperature", temperature, minTemperature, maxTemperature, msg.timestamp);
            }

            if (humidity < minHumidity || humidity > maxHumidity) {
                sendEmail(topicId, "Humidity", humidity, minHumidity, maxHumidity, msg.timestamp);
            }

            if (pressure < minPressure || pressure > maxPressure) {
                sendEmail(topicId, "Air Pressure", pressure, minPressure, maxPressure, msg.timestamp);
            }
        }

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

function sendEmail(topicId, metric, value, min, max, timestamp) {
    if (!settings[topicId]) return;
    if (!settings[topicId]["email"]) return; // check if email is set
    if (!settings[topicId]["lastAlert"]) return;

    // check if email has been sent less than 4 hours
    if (settings[topicId]["lastAlert"][metric]) {
        if (timestamp < settings[topicId]["lastAlert"][metric] + 4 * 60 * 60 * 1000) {
            console.log("Already send email less than 4 hours ago");
            return;
        }
    }

    try {
        const readableDate = new Date(timestamp).toLocaleString();
        const unit = units[metric];

        const subject = `[${settings[topicId]["name"]}] ${metric} out of range (${value})`;
        const html = `
            <p>Value measured at ${readableDate}: ${value} ${unit} exceeding the limits:</p>
            <p>Min: ${min} ${unit}</p>
            <p>Max: ${max} ${unit}</p>
            <p><a href="https://trusense.africa/topic/${topicId}">Inspect the charts.</a></p>
            <p><a href="https://trusense.africa/login">Login into your Dashboard to update the alerts.</a></p>
        `;

        const text = html.replace(/<[^>]+>/g, "");

        const msg = {
            to: settings[topicId]["email"],
            from: process.env.MAIL_SENDER,
            subject: subject,
            text: text,
            html: html,
        };

        // sgMail.send(msg);
        console.log("Ready to send email:", subject);

        // store timestamp of mail
        settings[topicId]["lastAlert"][metric] = timestamp;
    } catch (err) {
        console.error(err);
    }
}

app.post("/settings/:topicId", (req, res) => {
    const topicId = req.params.topicId;

    // Check if the topic exists
    if (!settings[topicId]) {
        // push empty new topic settings
        settings[topicId] = {};
    }

    for (const [key, value] of Object.entries(req.body)) {
        if (value != null) {
            settings[topicId][key] = value;
            console.log("Setting stored: " + value);
            console.log(settings);
        }
    }

    res.json({ status: "ok", received: { body: req.body } });
});

app.get("/device-settings/:topicId", (req, res) => {
    const id = req.params.topicId;
    if (deviceSettings[id]) {
        res.json(deviceSettings[id]);
    } else {
        res.status(404).json({ error: "Device settings not found" });
    }
});

app.post("/device-settings/:topicId", (req, res) => {
    const topicId = req.params.topicId;
    if (!deviceSettings[topicId]) {
        // push empty new topic settings
        deviceSettings[topicId] = {};
    }

    for (const [key, value] of Object.entries(req.body)) {
        if (value != null) {
            deviceSettings[topicId][key] = value;
            console.log("Updated device settings: " + key + ":" + value);
        }
    }

    res.json({ status: "ok", received: { body: req.body } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
