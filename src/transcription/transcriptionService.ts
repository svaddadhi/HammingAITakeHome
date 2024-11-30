import { createClient } from "@deepgram/sdk";
import logger from "../utils/logger.js";

interface TranscriptionResult {
  text: string;
  confidence: number;
}

/**
 * The service is configured to handle English language conversations with
 * specific optimizations for customer service interactions, including:
 * - Smart formatting for numbers, dates, and currency
 * - Punctuation for better readability
 * - Speaker diarization to distinguish between speakers
 */
export class TranscriptionService {
  private deepgramClient;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Deepgram API key is required for transcription");
    }

    this.deepgramClient = createClient(apiKey);
    logger.info("TranscriptionService initialized with Deepgram client");
  }

  /**
   * @param audioBuffer - The audio data to transcribe
   * @returns A promise containing the transcribed text and confidence score
   * @throws Error if transcription fails
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
    try {
      logger.info("Starting audio transcription", {
        bufferSize: audioBuffer.length,
        timestamp: new Date().toISOString(),
      });

      const { result, error } =
        await this.deepgramClient.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: "nova-2",
            smart_format: true,
            utterance_split: false,
            punctuate: true,
            diarize: true,
            numerals: true,
            language: "en-US",
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

      logger.info("Successfully transcribed audio", {
        confidenceScore: confidence,
        transcriptLength: transcript.length,
        transcriptPreview: transcript.substring(0, 50),
        timestamp: new Date().toISOString(),
      });

      return {
        text: transcript,
        confidence: confidence || 0,
      };
    } catch (error) {
      logger.error("Failed to transcribe audio", {
        error: error instanceof Error ? error.message : "Unknown error",
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString(),
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
   * This method is used when the audio is hosted remotely
   *
   * @param audioUrl - URL of the audio file to transcribe
   * @returns A promise containing the transcribed text and confidence score
   * @throws Error if transcription fails
   */
  async transcribeUrl(audioUrl: string): Promise<TranscriptionResult> {
    try {
      logger.info("Starting URL audio transcription", {
        url: audioUrl,
        timestamp: new Date().toISOString(),
      });

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
        transcriptPreview: transcript.substring(0, 50),
        timestamp: new Date().toISOString(),
      });

      return {
        text: transcript,
        confidence: confidence || 0,
      };
    } catch (error) {
      logger.error("Failed to transcribe URL audio", {
        error: error instanceof Error ? error.message : "Unknown error",
        url: audioUrl,
        timestamp: new Date().toISOString(),
      });

      throw new Error(
        `URL transcription failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
