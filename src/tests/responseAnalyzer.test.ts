jest.mock("../utils/logger.js");

process.env.OPENAI_API_KEY = "test-api-key";

jest.mock("../utils/openai.js", () => ({
  generateResponses: jest
    .fn()
    .mockResolvedValue(["Generated prompt 1", "Generated prompt 2"]),
}));

import { describe, test, expect, beforeEach } from "@jest/globals";
import { ResponseAnalyzer } from "../analyzer/responseAnalyzer.js";

describe("ResponseAnalyzer", () => {
  let analyzer: ResponseAnalyzer;

  beforeEach(() => {
    analyzer = new ResponseAnalyzer();
  });

  test("should analyze response and generate identified paths", async () => {
    const response =
      "Thank you for calling our air conditioning and plumbing company. How can I assist you today?";

    const analysisResult = await analyzer.analyzeResponse(response);

    expect(analysisResult).toBeDefined();
    expect(analysisResult.identifiedPaths).toBeInstanceOf(Array);
    expect(analysisResult.identifiedPaths.length).toBeGreaterThan(0);
    expect(analysisResult.isTerminalState).toBe(false);
    expect(analysisResult.confidence).toBeGreaterThan(0);
  });

  test("should detect terminal state when response includes goodbye", async () => {
    const response = "Thank you for calling. Goodbye!";

    const analysisResult = await analyzer.analyzeResponse(response);

    expect(analysisResult.isTerminalState).toBe(true);
    expect(analysisResult.identifiedPaths).toBeInstanceOf(Array);
  });

  test("should detect business type from response", async () => {
    const response =
      "Welcome to our auto dealership. How can we help you today?";

    await analyzer.analyzeResponse(response);

    const context = (analyzer as any)["context"];

    expect(context.businessType).toBe("auto_dealership");
  });

  test("should update conversation context with requested info", async () => {
    const response = "Can I get your full name and phone number, please?";

    await analyzer.analyzeResponse(response);

    const context = (analyzer as any)["context"];

    expect(context.requestedInfo).toContain("name");
    expect(context.requestedInfo).toContain("phone");
  });

  test("should handle errors gracefully and provide default prompts", async () => {
    const spy = jest
      .spyOn(analyzer as any, "updateConversationContext")
      .mockImplementation(() => {
        throw new Error("Test error");
      });

    const response = "Test response causing error";

    const analysisResult = await analyzer.analyzeResponse(response);

    expect(analysisResult).toBeDefined();
    expect(analysisResult.identifiedPaths).toBeInstanceOf(Array);
    expect(analysisResult.isTerminalState).toBe(false);
    expect(analysisResult.confidence).toBe(0.3);

    spy.mockRestore();
  });
});
