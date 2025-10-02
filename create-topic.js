// create-topic.js
import { Client, PrivateKey, TopicCreateTransaction } from "@hashgraph/sdk";
import "dotenv/config"; // Load environment variables from .env
import e from "express";
import { exit } from "process";

// Load your Hedera credentials
const operatorId = process.env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

// Create Hedera client
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

async function main() {
    try {
        // Create a new topic
        const tx = new TopicCreateTransaction();
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
