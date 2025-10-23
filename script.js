// script.js
const sgMail = require("@sendgrid/mail");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Client, TopicMessageSubmitTransaction, PrivateKey } = require("@hashgraph/sdk");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 🔑 Load credentials from environment variables
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

const client = Client.forTestnet().setOperator(operatorId, operatorKey);

const subscribers = {};

const deviceSettings = {
    "0.0.7001056": {
        interval: 30000,
    },
};

// fetch subscribers from database if missing (e.g. after server restart)
async function fetchSensorSubscribers(topicId) {
    console.log("Fetching subscribers for topic... ", topicId);
    try {
        const query = `
    SELECT *
    FROM "Sensor"
    WHERE "topicId" = $1
  `;
        const { rows } = await pool.query(query, [topicId]);
        console.log(rows);
        return rows;
    } catch (err) {
        console.log(err);
        return {}; // avoids trying to fetch again
    }
}

const units = {
    Temperature: "°C",
    Humidity: "%",
    "Air Pressure": "hPa",
};

// post route for sensor to send data
app.post("/data", async (req, res) => {
    const { topicId, temperature, humidity, pressure } = req.body;
    const msg = { temperature, humidity, airPressure: pressure, timestamp: Date.now() };
    const message = JSON.stringify(msg);

    try {
        const tx = await new TopicMessageSubmitTransaction({
            topicId,
            message,
        }).execute(client);

        res.json({ status: "ok", sent: message, txId: tx.transactionId.toString() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }

    // get subscribers from database if missing (e.g. after server restart)
    if (!subscribers[topicId]) {
        // create subscribers object

        const subscriberData = await fetchSensorSubscribers(topicId);
        if (!subscriberData) return;

        subscribers[topicId] = {}; // create empty object

        // add all subscribers from database to subscribers object

        for (const s of subscriberData) {
            subscribers[s.topicId][s.subscriberId] = s;
        }
    }

    // send alerts to subscribers if needed
    if (subscribers[topicId]) {
        const topicSubscribers = subscribers[topicId];
        const numTopicSubscribers = Object.keys(topicSubscribers).length;

        console.log("Num subscribers: ", numTopicSubscribers);

        if (numTopicSubscribers > 0) {
            // loop through all subscribers
            for (const subscriber of Object.values(topicSubscribers)) {
                const subscriberId = subscriber["subscriberId"];

                const minTemperature = subscriber["minTemp"] || -9999;
                const maxTemperature = subscriber["maxTemp"] || 9999;
                const minHumidity = subscriber["minHum"] || -9999;
                const maxHumidity = subscriber["maxHum"] || 9999;
                const minPressure = subscriber["minPres"] || -9999;
                const maxPressure = subscriber["maxPres"] || 9999;

                if (temperature < minTemperature || temperature > maxTemperature) {
                    sendEmail(
                        subscriberId,
                        topicId,
                        "Temperature",
                        temperature,
                        minTemperature,
                        maxTemperature,
                        msg.timestamp,
                    );
                }

                if (humidity < minHumidity || humidity > maxHumidity) {
                    sendEmail(subscriberId, topicId, "Humidity", humidity, minHumidity, maxHumidity, msg.timestamp);
                }

                if (pressure < minPressure || pressure > maxPressure) {
                    sendEmail(subscriberId, topicId, "Air Pressure", pressure, minPressure, maxPressure, msg.timestamp);
                }
            } // for
        } //if
    }
});

function sendEmail(subscriberId, topicId, metric, value, min, max, timestamp) {
    if (!subscribers[topicId]) return;
    if (!subscribers[topicId][subscriberId]) return;
    if (!subscribers[topicId][subscriberId]["email"]) return; // check if email is set

    // create lastAlert object if it doesn't exist
    if (!subscribers[topicId][subscriberId]["lastAlert"]) {
        subscribers[topicId][subscriberId]["lastAlert"] = {
            Temperature: 0,
            Humidity: 0,
            "Air Pressure": 0,
        };
    }

    // check if email has been sent less than 4 hours
    if (subscribers[topicId][subscriberId]["lastAlert"][metric]) {
        if (timestamp < subscribers[topicId][subscriberId]["lastAlert"][metric] + 4 * 60 * 60 * 1000) {
            console.log("Already send email less than 4 hours ago");
            return;
        }
    }

    try {
        const readableDate = new Date(timestamp).toLocaleString();
        const unit = units[metric];

        const sensorName = subscribers[topicId][subscriberId]["name"]; // get sensor name (given by subscriber)
        const email = subscribers[topicId][subscriberId]["email"];

        const subject = `[${sensorName}] ${metric} Out of Range`;
        const html = `
            <p><strong>${metric} Alert for ${sensorName}</strong></p>
            <p>A temperature reading has exceeded the defined limits.</p>
            <ul>
                <li>Measured at: ${readableDate}</li>
                <li>Recorded value: ${value} ${unit}</li>
                ${min !== -9999 ? `<li>Minimum ${metric}: ${min} ${unit}</li>` : ""}
                ${max !== 9999 ? `<li>Maximum ${metric}: ${max} ${unit}</li>` : ""}
            </ul>

            <p>Please review the <a href="https://trusense.africa/topic/${topicId}">data</a> for more details.<br>
<a href="https://trusense.africa/login">Log in</a> to your Dashboard to adjust alert settings or update the limits.</p>
        `;

        const text = html.replace(/<[^>]+>/g, "");

        const msg = {
            to: email,
            from: process.env.MAIL_SENDER,
            subject: subject,
            text: text,
            html: html,
        };

        console.log("Going to send email:", subject);
        sgMail.send(msg);

        // store timestamp of mail
        subscribers[topicId][subscriberId]["lastAlert"][metric] = timestamp;
    } catch (err) {
        console.error(err);
    }
}

// post route for website to send new topic subscribers
app.post("/settings/:topicId/:subscriberId", (req, res) => {
    const topicId = req.params.topicId;
    const subscriberId = req.params.subscriberId;

    // Check if the topic exists, if not, push empty object
    if (!subscribers[topicId]) {
        settings[topicId] = {};
    }

    // Check if the subscriber exists, if not, push empty object
    if (!subscribers[topicId][subscriberId]) {
        subscribers[topicId][subscriberId] = {};
    }

    for (const [key, value] of Object.entries(req.body)) {
        if (value != null) {
            subscribers[topicId][subscriberId][key] = value;
            // console.log("Setting stored for subscriber: " + subscriberId + ": " + value);
            console.log(subscribers[topicId][subscriberId]);
        }
    }

    res.json({ status: "ok", received: { body: req.body } });
});

// get route for sensor to get device settings
app.get("/device-settings/:topicId", (req, res) => {
    const id = req.params.topicId;
    if (deviceSettings[id]) {
        res.json(deviceSettings[id]);
    } else {
        res.status(404).json({ error: "Device settings not found" });
    }
});

// post route for website to send device settings
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
