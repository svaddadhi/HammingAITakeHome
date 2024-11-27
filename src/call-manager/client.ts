import axios, { AxiosResponse } from "axios";
import logger from "../utils/logger.js";

interface CallRequest {
  phone_number: string;
  prompt: string;
  webhook_url: string;
}
interface CallResponse {
  id: string;
}

export class CallManager {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    if (!baseUrl || !token) {
      throw new Error("baseUrl and token are reuquired");
    }

    this.baseUrl = baseUrl;
    this.token = token;
  }

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

    try {
      logger.info("Initiating voice agent call", { phoneNumber, webhookUrl });
      const response: AxiosResponse<CallResponse> = await axios.post(
        `${process.env.baseUrl}/start-call`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${process.env.token}`,
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
}
