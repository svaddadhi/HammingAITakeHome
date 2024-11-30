// src/index.ts

import "dotenv/config.js";
import Server from "./server.js";
import { CallManager } from "./call-manager/client.js";
import { WebhookHandler } from "./webhook/index.js";
import { DiscoveryOrchestrator } from "./orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "./transcription/transcriptionService.js";
import logger from "./utils/logger.js";

// This function ensures all required environment variables are present
function validateEnvironmentVariables() {
  const required = [
    "BASE_URL", // Voice agent API base URL
    "API_TOKEN", // Authentication token for the API
    "DEEPGRAM_API_KEY", // API key for transcription service
    "TARGET_PHONE_NUMBER", // Phone number to call
    "WEBHOOK_URL", // URL for receiving call status updates
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

// This function initializes and starts our discovery system
async function startServer() {
  validateEnvironmentVariables();

  try {
    // Initialize our core services with appropriate configuration
    const transcriptionService = new TranscriptionService(
      process.env.DEEPGRAM_API_KEY!
    );

    const callManager = new CallManager(
      process.env.BASE_URL!,
      process.env.API_TOKEN!
    );

    // Configure the discovery orchestrator with our exploration parameters
    const orchestrator = new DiscoveryOrchestrator(callManager, {
      maxDepth: 5, // Maximum conversation depth to explore
      maxConcurrentCalls: 3, // Maximum parallel conversations
      initialPrompt:
        "You are a customer calling to learn about available services. When the agent answers, ask about their main service offerings and show interest in learning more details.",
      phoneNumber: process.env.TARGET_PHONE_NUMBER!,
      webhookUrl: `${process.env.WEBHOOK_URL}/webhook/callback`,
    });

    // Set up the webhook handler to process call status updates
    const webhookHandler = new WebhookHandler(
      callManager,
      orchestrator,
      transcriptionService
    );

    // Initialize and start the server
    const server = new Server(Number(process.env.PORT) || 3000);
    server.addRoute("/webhook", webhookHandler.getRouter());
    await server.start();

    // Begin the discovery process
    await orchestrator.startDiscovery();

    logger.info("Voice agent discovery system started successfully", {
      targetPhone: process.env.TARGET_PHONE_NUMBER,
      webhookUrl: process.env.WEBHOOK_URL,
    });
  } catch (error) {
    logger.error("Failed to start voice agent discovery system", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

// Start the system
startServer();
