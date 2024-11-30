jest.mock("../utils/logger.js");

// Mock createClient function from Deepgram SDK
jest.mock("@deepgram/sdk", () => {
  const mockTranscribeFile = jest.fn();

  return {
    createClient: jest.fn().mockReturnValue({
      listen: {
        prerecorded: {
          transcribeFile: mockTranscribeFile,
        },
      },
    }),
  };
});

import { jest } from "@jest/globals";
import { TranscriptionService } from "../transcription/transcriptionService.js";

interface DeepgramTranscriptionResponse {
  results?: {
    channels: Array<{
      alternatives: Array<{
        transcript: string;
        confidence: number;
      }>;
    }>;
  };
}

describe("TranscriptionService", () => {
  let transcriptionService: TranscriptionService;
  const apiKey = "test_api_key";
  let mockTranscribeFile: jest.MockedFunction<
    (
      audioBuffer: Buffer,
      options: any
    ) => Promise<DeepgramTranscriptionResponse>
  >;

  beforeEach(() => {
    transcriptionService = new TranscriptionService(apiKey);

    const deepgramSdk = require("@deepgram/sdk");
    mockTranscribeFile =
      deepgramSdk.createClient().listen.prerecorded.transcribeFile;

    mockTranscribeFile.mockReset();
  });

  test("should transcribe audio buffer successfully", async () => {
    const mockTranscript = "This is a test transcription.";
    const mockResponse: DeepgramTranscriptionResponse = {
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: mockTranscript,
                confidence: 0.95,
              },
            ],
          },
        ],
      },
    };

    mockTranscribeFile.mockResolvedValue(mockResponse);

    const audioBuffer = Buffer.from("test audio data");
    const result = await transcriptionService.transcribeAudio(audioBuffer);

    expect(result.text).toBe(mockTranscript);
    expect(result.confidence).toBe(0.95);
    expect(mockTranscribeFile).toHaveBeenCalled();
  });

  test("should handle errors during transcription", async () => {
    const mockError = new Error("Transcription Error");

    mockTranscribeFile.mockRejectedValue(mockError);

    const audioBuffer = Buffer.from("test audio data");

    await expect(
      transcriptionService.transcribeAudio(audioBuffer)
    ).rejects.toThrowError("Transcription failed: Transcription Error");
  });
});
