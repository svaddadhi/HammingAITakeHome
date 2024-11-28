import { Router, Request, Response } from "express";
import { CallManager } from "../call-manager/client.js";
import { DiscoveryOrchestrator } from "../orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "../transcription/transcriptionService.js";
import logger from "../utils/logger.js";

interface WebhookPayload {
  id: string;
  status: "initiated" | "in-progress" | "completed" | "failed";
  recording_available: boolean;
}

/**
 * WebhookHandler manages incoming notifications about voice agent calls.
 * It coordinates with the DiscoveryOrchestrator to manage the discovery process
 * and uses TranscriptionService to process audio recordings.
 */
export class WebhookHandler {
  private router: Router;
  private callManager: CallManager;
  private orchestrator: DiscoveryOrchestrator;
  private transcriptionService: TranscriptionService;

  constructor(
    callManager: CallManager,
    orchestrator: DiscoveryOrchestrator,
    transcriptionService: TranscriptionService
  ) {
    this.router = Router();
    this.callManager = callManager;
    this.orchestrator = orchestrator;
    this.transcriptionService = transcriptionService;
    this.configureRoutes();
  }

  private configureRoutes(): void {
    this.router.post("/callback", this.handleWebhook.bind(this));
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = this.validatePayload(req.body);

      logger.info("Received webhook notification", {
        callId: payload.id,
        status: payload.status,
        recordingAvailable: payload.recording_available,
      });

      // Process webhook based on status
      await this.processWebhook(payload);

      // Send immediate acknowledgment
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error("Error processing webhook", {
        error: error instanceof Error ? error.message : "Unknown error",
        body: req.body,
      });

      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  private validatePayload(body: any): WebhookPayload {
    if (!body?.id || !body?.status) {
      throw new Error("Invalid webhook payload: missing required fields");
    }

    const validStatuses = ["initiated", "in-progress", "completed", "failed"];
    if (!validStatuses.includes(body.status)) {
      throw new Error(`Invalid status: ${body.status}`);
    }

    return body as WebhookPayload;
  }

  private async processWebhook(payload: WebhookPayload): Promise<void> {
    switch (payload.status) {
      case "completed":
        if (payload.recording_available) {
          try {
            // Retrieve the recording
            const recording = await this.callManager.retrieveRecording(
              payload.id
            );

            // Transcribe the recording
            logger.info("Starting transcription for call", {
              callId: payload.id,
            });
            const transcriptionResult =
              await this.transcriptionService.transcribeAudio(recording);

            logger.info("Transcription completed", {
              callId: payload.id,
              confidence: transcriptionResult.confidence,
            });

            // Pass transcribed text to orchestrator for processing
            await this.orchestrator.handleCallCompleted(
              payload.id,
              transcriptionResult.text
            );
          } catch (error) {
            logger.error("Failed to process recording", {
              error: error instanceof Error ? error.message : "Unknown error",
              callId: payload.id,
            });

            await this.orchestrator.handleCallFailed(payload.id);
          }
        }
        break;

      case "failed":
        await this.orchestrator.handleCallFailed(payload.id);
        break;

      case "initiated":
      case "in-progress":
        logger.info("Call status update", {
          callId: payload.id,
          status: payload.status,
        });
        break;
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
