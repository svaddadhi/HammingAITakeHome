import axios, { AxiosResponse } from "axios";
import logger from "../utils/logger.js";
import axiosRetry from "axios-retry";

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
});

interface CallRequest {
  phone_number: string;
  prompt: string;
  webhook_url: string;
}
interface CallResponse {
  id: string;
}

/**
 * Manages voice agent calls and recording retrieval
 * @class CallManager
 */
export class CallManager {
  /**
   * Creates a new instance of CallManager
   * @param baseUrl - Base URL for the API
   * @param token - Authentication token
   * @throws Error if baseUrl or token is missing
   */
  baseUrl: string;
  token: string;
  constructor(baseUrl: string, token: string) {
    if (!baseUrl || !token) {
      throw new Error("baseUrl and token are reuquired");
    }

    this.baseUrl = baseUrl;
    this.token = token;
  }

  /**
   * Initiates a call to the specified phone number
   * @param phoneNumber - Target phone number in E.164 format
   * @param prompt - System prompt for the voice agent
   * @param webhookUrl - URL to receive call status updates
   * @returns Promise containing the call ID
   * @throws Error if the API call fails or parameters are invalid
   */
  async startCall(
    phoneNumber: string,
    prompt: string,
    webhookUrl: string
  ): Promise<string> {
    const requestData: CallRequest = {
      phone_number: phoneNumber,
      prompt,
      webhook_url: webhookUrl,
    };
    if (!phoneNumber || !prompt || !webhookUrl) {
      throw new Error("Phone number, prompt, and webhook URL are required");
    }
    try {
      logger.info("Initiating voice agent call", { phoneNumber, webhookUrl });
      const response: AxiosResponse<CallResponse> = await axios.post(
        `${this.baseUrl}/start-call`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info("Call initiated successfully", {
        callId: response.data.id,
        phoneNumber,
      });
      return response.data.id;
    } catch (error) {
      logger.error("Failed to initiate call", {
        error: error instanceof Error ? error.message : "Unknown error",
        phoneNumber,
      });
      throw new Error(
        `Failed to initiate call to ${phoneNumber}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async retrieveRecording(callId: string): Promise<Blob> {
    try {
      logger.info("Retrieving the recording", { id: callId });
      const response: AxiosResponse = await axios.get(
        "https://app.hamming.ai/api/media/exercise",
        {
          params: { id: callId },
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );
      logger.info("Successfully retrieved recording");
      return response.data;
    } catch (error) {
      logger.error("Failed to retrieve recording", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw new Error(
        `Failed to retrieve recording: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
