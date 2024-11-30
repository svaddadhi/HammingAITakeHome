import { Router, Request, Response } from "express";
import { CallManager } from "../call-manager/client.js";
import { DiscoveryOrchestrator } from "../orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "../transcription/transcriptionService.js";
import logger from "../utils/logger.js";

interface WebhookPayload {
  id: string;
  status:
    | "initiated"
    | "in-progress"
    | "completed"
    | "failed"
    | "event_phone_call_connected"
    | "event_phone_call_ended"
    | "event_recording";
  recording_available: boolean;
}

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

  /**
   * Processes incoming webhook notifications from the voice agent API
   */
  protected async handleWebhook(req: Request, res: Response): Promise<void> {
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

      await this.processWebhook(payload);

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

  private async handleRecordingAvailable(callId: string): Promise<void> {
    try {
      logger.info("Processing available recording", { callId });

      const recordingBuffer = await this.callManager.retrieveRecording(callId);

      const transcriptionResult =
        await this.transcriptionService.transcribeAudio(recordingBuffer);

      logger.info("Successfully transcribed recording", {
        callId,
        confidence: transcriptionResult.confidence,
        transcriptLength: transcriptionResult.text.length,
      });

      await this.orchestrator.handleCallCompleted(
        callId,
        transcriptionResult.text
      );
    } catch (error) {
      logger.error("Failed to process recording", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });

      await this.orchestrator.handleCallFailed(callId);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}
