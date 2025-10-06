// create-topic.js

// run with node: node create-topic.js

const { Client, PrivateKey, TopicCreateTransaction } = require("@hashgraph/sdk");
const { exit } = require("process");
require("dotenv").config();

// Load your Hedera credentials
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

// Create Hedera client
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
    try {
        // Create a new topic
        const tx = new TopicCreateTransaction().setSubmitKey(operatorKey);
        const submitTx = await tx.execute(client);

        // Get the receipt
        const receipt = await submitTx.getReceipt(client);

        // Extract Topic ID
        const topicId = receipt.topicId.toString();
        console.log("✅ New topic created with ID:", topicId);
    } catch (err) {
        console.error("❌ Error creating topic:", err);
    }

    // Close the client
    client.close();

    exit(0);
}

main();
