import Server from "./server.js";
import { CallManager } from "./call-manager/client.js";
import { WebhookHandler } from "./webhook/index.js";
import { DiscoveryOrchestrator } from "./orchestrator/discoveryOrchestrator.js";
import logger from "./utils/logger.js";

async function startServer() {
  try {
    // Initialize CallManager
    const callManager = new CallManager(
      process.env.BASE_URL!,
      process.env.API_TOKEN!
    );

    // Initialize DiscoveryOrchestrator with configuration
    const orchestrator = new DiscoveryOrchestrator(callManager, {
      maxDepth: 5,
      maxConcurrentCalls: 3,
      initialPrompt: "Hello, I'd like to learn about your services",
      phoneNumber: process.env.TARGET_PHONE_NUMBER!,
      webhookUrl: process.env.WEBHOOK_URL!,
    });

    // Initialize WebhookHandler with both dependencies
    const webhookHandler = new WebhookHandler(callManager, orchestrator);

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
