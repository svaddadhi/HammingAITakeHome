import { createClient } from "@deepgram/sdk";
import logger from "../utils/logger.js";

interface TranscriptionResult {
  text: string;
  confidence: number;
}

interface DeepgramResponse {
  results: {
    channels: [
      {
        alternatives: [
          {
            transcript: string;
            confidence: number;
          }
        ];
      }
    ];
  };
}

/**
 * TranscriptionService handles the conversion of audio recordings to text
 * using the Deepgram API. It provides methods for transcribing both
 * audio blobs and files.
 */
export class TranscriptionService {
  private deepgramClient;

  /**
   * Creates a new instance of TranscriptionService
   * @param apiKey - Deepgram API key
   * @throws Error if API key is not provided
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Deepgram API key is required");
    }

    this.deepgramClient = createClient(apiKey);
  }

  /**
   * Transcribes an audio blob to text
   * @param audioBlob - The audio blob to transcribe
   * @returns Promise containing the transcription result
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      logger.info("Starting audio transcription");

      const buffer = Buffer.from(await audioBlob.arrayBuffer());

      const { result, error } =
        await this.deepgramClient.listen.prerecorded.transcribeFile(buffer, {
          model: "nova-2",
          smart_format: true,
        });

      if (error) {
        throw error;
      }

      // Extract the transcript and confidence from the response
      const transcript =
        result.results?.channels[0]?.alternatives[0]?.transcript;
      const confidence =
        result.results?.channels[0]?.alternatives[0]?.confidence;

      if (!transcript) {
        throw new Error("No transcript received from Deepgram");
      }

      logger.info("Successfully transcribed audio", {
        confidenceScore: confidence,
        transcriptLength: transcript.length,
      });

      return {
        text: transcript,
        confidence: confidence || 0,
      };
    } catch (error) {
      logger.error("Failed to transcribe audio", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error(
        `Transcription failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Transcribes audio from a URL
   * @param audioUrl - URL of the audio file to transcribe
   * @returns Promise containing the transcription result
   */
  async transcribeUrl(audioUrl: string): Promise<TranscriptionResult> {
    try {
      logger.info("Starting URL audio transcription", { url: audioUrl });

      const { result, error } =
        await this.deepgramClient.listen.prerecorded.transcribeUrl(
          {
            url: audioUrl,
          },
          {
            model: "nova-2",
            smart_format: true,
          }
        );

      if (error) {
        throw error;
      }

      const transcript =
        result.results?.channels[0]?.alternatives[0]?.transcript;
      const confidence =
        result.results?.channels[0]?.alternatives[0]?.confidence;

      if (!transcript) {
        throw new Error("No transcript received from Deepgram");
      }

      logger.info("Successfully transcribed URL audio", {
        url: audioUrl,
        confidenceScore: confidence,
        transcriptLength: transcript.length,
      });

      return {
        text: transcript,
        confidence: confidence || 0,
      };
    } catch (error) {
      logger.error("Failed to transcribe URL audio", {
        error: error instanceof Error ? error.message : "Unknown error",
        url: audioUrl,
      });

      throw new Error(
        `URL transcription failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
