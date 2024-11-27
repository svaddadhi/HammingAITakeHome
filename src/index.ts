import Server from "./server";
import { CallManager } from "./call-manager/client.js";
import { WebhookHandler } from "./webhook/webhookHandler.js";
import logger from "./utils/logger.js";

async function startServer() {
  try {
    const callManager = new CallManager(
      process.env.BASE_URL!,
      process.env.API_TOKEN!
    );

    const webhookHandler = new WebhookHandler(callManager);

    const server = new Server(Number(process.env.PORT) || 3000);

    server.addRoute("/webhook", webhookHandler.getRouter());

    await server.start();
  } catch (error) {
    logger.error("Failed to start application", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

startServer();
