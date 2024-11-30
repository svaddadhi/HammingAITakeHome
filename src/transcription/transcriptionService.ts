// src/transcription/transcriptionService.ts

import { createClient } from "@deepgram/sdk";
import logger from "../utils/logger.js";

// This interface defines the structure of our transcription results
interface TranscriptionResult {
  text: string; // The transcribed text
  confidence: number; // How confident Deepgram is in the transcription
}

/**
 * TranscriptionService handles the conversion of voice agent recordings to text.
 * It uses Deepgram's AI-powered speech recognition to accurately transcribe
 * conversations, enabling us to analyze the agent's responses and identify
 * new conversation paths to explore.
 *
 * The service is configured to handle English language conversations with
 * specific optimizations for customer service interactions, including:
 * - Smart formatting for numbers, dates, and currency
 * - Punctuation for better readability
 * - Speaker diarization to distinguish between speakers
 */
export class TranscriptionService {
  private deepgramClient;

  /**
   * Creates a new instance of TranscriptionService
   * @param apiKey - Authentication key for Deepgram's API
   * @throws Error if the API key is not provided
   */
  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("Deepgram API key is required for transcription");
    }

    this.deepgramClient = createClient(apiKey);
    logger.info("TranscriptionService initialized with Deepgram client");
  }

  /**
   * Transcribes an audio recording from a buffer
   * This method is used when we have the complete audio data in memory
   *
   * @param audioBuffer - The audio data to transcribe
   * @returns A promise containing the transcribed text and confidence score
   * @throws Error if transcription fails
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
    try {
      // Log the start of transcription with the audio size for debugging
      logger.info("Starting audio transcription", {
        bufferSize: audioBuffer.length,
        timestamp: new Date().toISOString(),
      });

      // Configure Deepgram with optimal settings for customer service calls
      const { result, error } =
        await this.deepgramClient.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            // Nova-2 model provides better accuracy for conversation transcription
            model: "nova-2",
            // Enable smart formatting for numbers and dates
            smart_format: true,
            // Disable utterance splits as we want complete sentences
            utterance_split: false,
            // Add punctuation for better readability
            punctuate: true,
            // Enable speaker identification
            diarize: true,
            // Convert numbers to digits
            numerals: true,
            // Specify language for better accuracy
            language: "en-US",
          }
        );

      if (error) {
        throw error;
      }

      // Extract the primary transcript and its confidence score
      const transcript =
        result.results?.channels[0]?.alternatives[0]?.transcript;
      const confidence =
        result.results?.channels[0]?.alternatives[0]?.confidence;

      if (!transcript) {
        throw new Error("No transcript received from Deepgram");
      }

      // Log successful transcription with quality metrics
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
      // Log detailed error information for debugging
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
            // Use same high-quality settings as file transcription
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
