import axios, { AxiosResponse } from "axios";
import axiosRetry from "axios-retry";
import logger from "../utils/logger.js";

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ?? 0) >= 500
    );
  },
});

interface CallResponse {
  id: string;
  status?: string;
}

export class CallManager {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    if (!baseUrl || !token) {
      throw new Error("baseUrl and token are required");
    }

    this.baseUrl = baseUrl;
    this.token = token;

    logger.info("CallManager initialized", {
      baseUrl,
      hasToken: !!token,
    });
  }

  async startCall(
    phoneNumber: string,
    systemPrompt: string,
    webhookUrl: string
  ): Promise<string> {
    if (!phoneNumber || !systemPrompt || !webhookUrl) {
      const error = new Error("Required parameters missing");
      logger.error("Call initiation failed - parameter validation", {
        hasPhoneNumber: !!phoneNumber,
        hasPrompt: !!systemPrompt,
        hasWebhookUrl: !!webhookUrl,
        error: error.message,
      });
      throw error;
    }

    try {
      const response: AxiosResponse<CallResponse> = await axios.post(
        `${this.baseUrl}/start-call`,
        {
          phone_number: phoneNumber,
          prompt: systemPrompt,
          webhook_url: webhookUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      logger.info("Call initiated successfully", {
        callId: response.data.id,
        phoneNumber,
        responseStatus: response.status,
      });

      return response.data.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to initiate call", {
        error: errorMessage,
        phoneNumber,
        axiosError: axios.isAxiosError(error)
          ? {
              status: error.response?.status,
              statusText: error.response?.statusText,
              data: error.response?.data,
            }
          : undefined,
      });

      throw new Error(
        `Failed to initiate call to ${phoneNumber}: ${errorMessage}`
      );
    }
  }

  /**
   * Retrieves the recording for a completed call
   * @param callId - ID of the call to retrieve
   * @returns Promise resolving to the recording buffer
   * @throws Error if the recording cannot be retrieved
   */
  async retrieveRecording(callId: string): Promise<Buffer> {
    try {
      logger.info("Retrieving recording", {
        callId,
        timestamp: new Date().toISOString(),
      });

      const response: AxiosResponse = await axios.get(
        `${this.baseUrl.replace(
          "/rest/exercise",
          ""
        )}/media/exercise?id=${callId}`,
        {
          responseType: "arraybuffer",
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          timeout: 15000, // 15 second timeout for retrieving recordings
        }
      );

      logger.info("Successfully retrieved recording", {
        callId,
        contentLength: response.data.length,
        contentType: response.headers["content-type"],
      });

      return Buffer.from(response.data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("Failed to retrieve recording", {
        error: errorMessage,
        callId,
        axiosError: axios.isAxiosError(error)
          ? {
              status: error.response?.status,
              statusText: error.response?.statusText,
            }
          : undefined,
      });

      throw new Error(`Failed to retrieve recording: ${errorMessage}`);
    }
  }
}
