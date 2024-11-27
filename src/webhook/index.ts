import { Router, Request, Response } from "express";
import { CallManager } from "../call-manager/client.js";
import logger from "../utils/logger.js";

interface WebhookPayload {
  id: string;
  status: "initiated" | "in-progress" | "completed" | "failed";
  recording_available: boolean;
}

/**
 * WebhookHandler manages incoming notifications about voice agent calls.
 * It processes status updates and coordinates with CallManager to retrieve
 * recordings when they become available.
 */
export class WebhookHandler {
  private router: Router;
  private callManager: CallManager;

  constructor(callManager: CallManager) {
    this.router = Router();
    this.callManager = callManager;

    this.configureRoutes();
  }

  /**
   * Configures the routes for handling webhook notifications.
   * Currently sets up a single POST endpoint for receiving updates.
   * @private
   */
  private configureRoutes(): void {
    // Handle incoming webhook notifications
    this.router.post("/callback", this.handleWebhook.bind(this));
  }

  /**
   * Handles incoming webhook notifications about call status changes.
   * When a recording becomes available, it triggers the retrieval process.
   * @param req - Express request object containing the webhook payload
   * @param res - Express response object
   */
  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Validate the webhook payload
      const payload = this.validatePayload(req.body);

      logger.info("Received webhook notification", {
        callId: payload.id,
        status: payload.status,
        recordingAvailable: payload.recording_available,
      });

      // Process the webhook based on call status
      await this.processWebhook(payload);

      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Error processing webhook", {
        error: error instanceof Error ? error.message : "Unknown error",
        body: req.body,
      });

      // Send error response
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Validates the incoming webhook payload matches our expected structure
   * @param body - Raw webhook payload
   * @returns Validated WebhookPayload
   * @throws Error if payload is invalid
   * @private
   */
  private validatePayload(body: any): WebhookPayload {
    // Perform basic validation of required fields
    if (!body?.id || !body?.status) {
      throw new Error("Invalid webhook payload: missing required fields");
    }

    // Validate status is one of our expected values
    const validStatuses = ["initiated", "in-progress", "completed", "failed"];
    if (!validStatuses.includes(body.status)) {
      throw new Error(`Invalid status: ${body.status}`);
    }

    return body as WebhookPayload;
  }

  /**
   * Processes webhook notifications based on call status and recording availability
   * @param payload - Validated webhook payload
   * @private
   */
  private async processWebhook(payload: WebhookPayload): Promise<void> {
    switch (payload.status) {
      case "completed":
        if (payload.recording_available) {
          try {
            // Retrieve the recording when it's available
            const recording = await this.callManager.retrieveRecording(
              payload.id
            );
            logger.info("Successfully retrieved recording", {
              callId: payload.id,
              size: recording.size,
            });

            // Here is where to pass the recording to the analysis system
            // For now, just log that we got it
            // TODO: Add call to analysis system when implemented
          } catch (error) {
            logger.error("Failed to retrieve recording", {
              error: error instanceof Error ? error.message : "Unknown error",
              callId: payload.id,
            });
            // Might want to implement retry logic here
          }
        }
        break;

      case "failed":
        logger.error("Call failed", {
          callId: payload.id,
        });
        // Might want to implement retry logic or alert monitoring
        break;

      default:
        logger.info("Call status update", {
          callId: payload.id,
          status: payload.status,
        });
    }
  }

  /**
   * Returns the configured router for use with Express
   * @returns Express Router instance
   */
  public getRouter(): Router {
    return this.router;
  }
}
