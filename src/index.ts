import "dotenv/config.js";
import Server from "./server.js";
import { CallManager } from "./call-manager/client.js";
import { WebhookHandler } from "./webhook/index.js";
import { DiscoveryOrchestrator } from "./orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "./transcription/transcriptionService.js";
import logger from "./utils/logger.js";

function validateEnvironmentVariables() {
  const required = [
    "BASE_URL",
    "API_TOKEN",
    "DEEPGRAM_API_KEY",
    "TARGET_PHONE_NUMBER",
    "WEBHOOK_URL",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

async function startServer() {
  validateEnvironmentVariables();

  try {
    // Initialize services
    const callManager = new CallManager(
      process.env.BASE_URL!,
      process.env.API_TOKEN!
    );

    const transcriptionService = new TranscriptionService(
      process.env.DEEPGRAM_API_KEY!
    );

    // Initialize orchestrator
    const orchestrator = new DiscoveryOrchestrator(callManager, {
      maxDepth: 5,
      maxConcurrentCalls: 3,
      initialPrompt: "Hello, I'd like to learn about your services",
      phoneNumber: process.env.TARGET_PHONE_NUMBER!,
      webhookUrl: process.env.WEBHOOK_URL!,
    });

    // Initialize webhook handler with all dependencies
    const webhookHandler = new WebhookHandler(
      callManager,
      orchestrator,
      transcriptionService
    );

    // Initialize and configure server
    const server = new Server(Number(process.env.PORT) || 3000);

    // Add webhook routes
    server.addRoute("/webhook", webhookHandler.getRouter());

    // Start the server
    await server.start();

    // Start the discovery process
    await orchestrator.startDiscovery();

    logger.info("Application started successfully");
  } catch (error) {
    logger.error("Failed to start application", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

startServer();
