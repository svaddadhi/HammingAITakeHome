jest.mock("../utils/logger.js");

// Set the dummy API key before importing modules
process.env.OPENAI_API_KEY = "test-api-key";

import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";
import { WebhookHandler } from "../webhook/index.js";
import { CallManager } from "../call-manager/client.js";
import { DiscoveryOrchestrator } from "../orchestrator/discoveryOrchestrator.js";
import { TranscriptionService } from "../transcription/transcriptionService.js";

jest.mock("../call-manager/client.js");
jest.mock("../orchestrator/discoveryOrchestrator.js");
jest.mock("../transcription/transcriptionService.js");

const MockedCallManager = CallManager as jest.MockedClass<typeof CallManager>;
const MockedDiscoveryOrchestrator = DiscoveryOrchestrator as jest.MockedClass<
  typeof DiscoveryOrchestrator
>;
const MockedTranscriptionService = TranscriptionService as jest.MockedClass<
  typeof TranscriptionService
>;

describe("WebhookHandler", () => {
  let app: express.Express;
  let callManager: jest.Mocked<CallManager>;
  let orchestrator: jest.Mocked<DiscoveryOrchestrator>;
  let transcriptionService: jest.Mocked<TranscriptionService>;
  let webhookHandler: WebhookHandler;

  beforeEach(() => {
    callManager = new MockedCallManager(
      "base_url",
      "token"
    ) as jest.Mocked<CallManager>;
    orchestrator = new MockedDiscoveryOrchestrator(
      callManager,
      {}
    ) as jest.Mocked<DiscoveryOrchestrator>;
    transcriptionService = new MockedTranscriptionService(
      "api_key"
    ) as jest.Mocked<TranscriptionService>;
    webhookHandler = new WebhookHandler(
      callManager,
      orchestrator,
      transcriptionService
    );

    app = express();
    app.use(express.json());
    app.use("/webhook", webhookHandler.getRouter());
  });

  test("should handle webhook notification for recording available", async () => {
    const payload = {
      id: "call_123",
      status: "completed",
      recording_available: true,
    };

    callManager.retrieveRecording.mockResolvedValue(Buffer.from("audio data"));
    transcriptionService.transcribeAudio.mockResolvedValue({
      text: "Transcribed text",
      confidence: 0.95,
    });
    orchestrator.handleCallCompleted.mockResolvedValue();

    await request(app)
      .post("/webhook/callback")
      .send(payload)
      .expect(200)
      .expect({ received: true });

    expect(callManager.retrieveRecording).toHaveBeenCalledWith("call_123");
    expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith(
      Buffer.from("audio data")
    );
    expect(orchestrator.handleCallCompleted).toHaveBeenCalledWith(
      "call_123",
      "Transcribed text"
    );
  });

  test("should handle webhook notification for failed call", async () => {
    const payload = {
      id: "call_123",
      status: "failed",
      recording_available: false,
    };

    orchestrator.handleCallFailed.mockResolvedValue();

    await request(app)
      .post("/webhook/callback")
      .send(payload)
      .expect(200)
      .expect({ received: true });

    expect(orchestrator.handleCallFailed).toHaveBeenCalledWith("call_123");
  });

  test("should return 400 for invalid payload", async () => {
    const payload = {
      invalid: "data",
    };

    await request(app).post("/webhook/callback").send(payload).expect(400);

    expect(orchestrator.handleCallCompleted).not.toHaveBeenCalled();
    expect(orchestrator.handleCallFailed).not.toHaveBeenCalled();
  });
});
