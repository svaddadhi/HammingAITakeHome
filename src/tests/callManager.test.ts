jest.mock("../utils/logger.js");

import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter";
import { CallManager } from "../call-manager/client.js";

describe("CallManager", () => {
  const baseUrl = "https://app.hamming.ai/api/rest/exercise";
  const token = "test_token";
  let callManager: CallManager;
  let axiosMock: AxiosMockAdapter;

  beforeEach(() => {
    axiosMock = new AxiosMockAdapter(axios);
    callManager = new CallManager(baseUrl, token);
  });

  afterEach(() => {
    axiosMock.restore();
  });

  test("should start a call successfully", async () => {
    const mockResponse = { id: "call_123" };

    axiosMock.onPost(`${baseUrl}/start-call`).reply(200, mockResponse);

    const phoneNumber = "+1234567890";
    const systemPrompt = "Test prompt";
    const webhookUrl = "https://example.com/webhook";

    const callId = await callManager.startCall(
      phoneNumber,
      systemPrompt,
      webhookUrl
    );

    expect(callId).toBe("call_123");
    expect(axiosMock.history.post.length).toBe(1);
    const requestData = JSON.parse(axiosMock.history.post[0].data);
    expect(requestData).toEqual({
      phone_number: phoneNumber,
      prompt: systemPrompt,
      webhook_url: webhookUrl,
    });
  });

  test("should handle errors when starting a call", async () => {
    axiosMock.onPost(`${baseUrl}/start-call`).networkError();

    const phoneNumber = "+1234567890";
    const systemPrompt = "Test prompt";
    const webhookUrl = "https://example.com/webhook";

    await expect(
      callManager.startCall(phoneNumber, systemPrompt, webhookUrl)
    ).rejects.toThrowError(
      "Failed to initiate call to +1234567890: Network Error"
    );
  });

  test("should retrieve a recording successfully", async () => {
    const mockRecording = Buffer.from("test audio data");
    const mediaUrl = `${baseUrl.replace(
      "/rest/exercise",
      ""
    )}/media/exercise?id=call_123`;

    axiosMock
      .onGet(mediaUrl)
      .reply(200, mockRecording, { "content-type": "audio/wav" });

    const callId = "call_123";
    const recording = await callManager.retrieveRecording(callId);

    expect(recording).toEqual(mockRecording);
    expect(axiosMock.history.get.length).toBe(1);
    expect(axiosMock.history.get[0].url).toBe(mediaUrl);
  });

  test("should handle errors when retrieving a recording", async () => {
    const callId = "call_123";
    const mediaUrl = `${baseUrl.replace(
      "/rest/exercise",
      ""
    )}/media/exercise?id=${callId}`;

    axiosMock.onGet(mediaUrl).networkError();

    await expect(callManager.retrieveRecording(callId)).rejects.toThrowError(
      "Failed to retrieve recording: Network Error"
    );
  });
});
