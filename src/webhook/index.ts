// src/webhook/index.ts

import { Router, Request, Response } from "express";
import { CallManager } from "../call-manager/client.js";
import { DiscoveryOrchestrator } from "../orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "../transcription/transcriptionService.js";
import logger from "../utils/logger.js";

// Define the structure of incoming webhook payloads from the voice agent API
interface WebhookPayload {
  id: string;
  status:
    | "initiated" // Call has started
    | "in-progress" // Call is ongoing
    | "completed" // Call has finished successfully
    | "failed" // Call failed
    | "event_phone_call_connected" // Phone connection established
    | "event_phone_call_ended" // Phone call ended
    | "event_recording"; // Recording is available
  recording_available: boolean;
}

/**
 * WebhookHandler manages incoming notifications about our voice agent calls.
 * It serves as the coordination point between the voice agent API and our
 * discovery system, processing call events and managing the flow of conversation
 * recordings through our analysis pipeline.
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

  /**
   * Sets up the webhook endpoint that receives call status updates
   */
  private configureRoutes(): void {
    this.router.post("/callback", this.handleWebhook.bind(this));
  }

  /**
   * Processes incoming webhook notifications from the voice agent API
   */
  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received webhook notification", {
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString(),
      });

      const payload = this.validatePayload(req.body);

      logger.info("Processing voice agent event", {
        callId: payload.id,
        status: payload.status,
        hasRecording: payload.recording_available,
      });

      // Process the webhook based on the call status
      await this.processWebhook(payload);

      // Send immediate acknowledgment to prevent retries
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

  /**
   * Validates the structure of incoming webhook payloads
   */
  private validatePayload(body: any): WebhookPayload {
    if (!body?.id || !body?.status) {
      throw new Error("Invalid webhook payload: missing required fields");
    }

    const validStatuses = [
      "initiated",
      "in-progress",
      "completed",
      "failed",
      "event_phone_call_connected",
      "event_phone_call_ended",
      "event_recording",
    ];

    if (!validStatuses.includes(body.status)) {
      throw new Error(`Invalid status: ${body.status}`);
    }

    return body as WebhookPayload;
  }

  /**
   * Routes webhook events to appropriate handlers based on call status
   */
  private async processWebhook(payload: WebhookPayload): Promise<void> {
    switch (payload.status) {
      case "completed":
      case "event_recording":
        if (payload.recording_available) {
          await this.handleRecordingAvailable(payload.id);
        } else {
          logger.warn("Call completed but recording not available", {
            callId: payload.id,
          });
        }
        break;

      case "failed":
        await this.orchestrator.handleCallFailed(payload.id);
        break;

      case "initiated":
      case "in-progress":
      case "event_phone_call_connected":
      case "event_phone_call_ended":
        logger.info("Call status update received", {
          callId: payload.id,
          status: payload.status,
        });
        break;

      default:
        logger.warn("Unhandled call status received", {
          callId: payload.id,
          status: payload.status,
        });
        break;
    }
  }

  /**
   * Processes available recordings by transcribing them and updating our discovery state
   */
  private async handleRecordingAvailable(callId: string): Promise<void> {
    try {
      logger.info("Processing available recording", { callId });

      // Retrieve the recording
      const recordingBuffer = await this.callManager.retrieveRecording(callId);

      // Transcribe the recording
      const transcriptionResult =
        await this.transcriptionService.transcribeAudio(recordingBuffer);

      logger.info("Successfully transcribed recording", {
        callId,
        confidence: transcriptionResult.confidence,
        transcriptLength: transcriptionResult.text.length,
      });

      // Pass the transcribed conversation to our orchestrator for analysis
      await this.orchestrator.handleCallCompleted(
        callId,
        transcriptionResult.text
      );
    } catch (error) {
      logger.error("Failed to process recording", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });

      // Notify orchestrator of failure so it can retry if needed
      await this.orchestrator.handleCallFailed(callId);
    }
  }

  /**
   * Returns the configured router for use in the Express application
   */
  public getRouter(): Router {
    return this.router;
  }
}
