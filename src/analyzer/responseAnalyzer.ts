// src/analyzer/responseAnalyzer.ts

import logger from "../utils/logger.js";
import { generateResponses } from "../utils/openai.js";

interface AnalysisResult {
  identifiedPaths: string[];
  isTerminalState: boolean;
  confidence: number;
}

/**
 * ResponseAnalyzer handles the analysis of voice agent responses and generates
 * appropriate system prompts for exploring different conversation paths.
 * It adapts its analysis based on the detected business context and
 * conversation state.
 */
export class ResponseAnalyzer {
  // Tracks the type of business we're interacting with
  private businessContext: string = "";

  // Universal indicators for conversation end points
  private static readonly TERMINAL_INDICATORS = [
    "goodbye",
    "thank you for calling",
    "have a nice day",
    "is there anything else",
    "end of our call",
    "have a great",
    "bye",
  ];

  // Universal markers for when the agent is expecting a response
  private static readonly CONVERSATION_INDICATORS = [
    "would you like",
    "can i help",
    "how can i",
    "what would you",
    "are you looking",
    "would you prefer",
    "do you need",
    "may i",
    "let me",
    "i can",
    "we have",
    "we offer",
    "is there",
    "could you",
    "what type",
    "which option",
    "speaking",
    "how may i",
    "how can i assist",
  ];

  constructor() {
    this.businessContext = "";
  }

  /**
   * Analyzes a voice agent's response to identify potential conversation paths
   * and generates appropriate system prompts for exploration
   */
  public async analyzeResponse(response: string): Promise<AnalysisResult> {
    try {
      const normalizedResponse = response.toLowerCase();

      // Detect business type if not already set
      if (!this.businessContext) {
        this.businessContext = this.detectBusinessType(response);
        logger.info("Detected business type", {
          businessContext: this.businessContext,
          responsePreview: response.substring(0, 50),
        });
      }

      // Handle different types of responses
      let identifiedPaths: string[] = [];
      let isTerminalState = false;

      // For initial greeting, generate context-aware initial prompts
      if (this.isInitialGreeting(normalizedResponse)) {
        identifiedPaths = await this.generateInitialSystemPrompts();
        isTerminalState = false;
      } else {
        // For ongoing conversation, analyze response and generate follow-up prompts
        identifiedPaths = await this.generateFollowUpPrompts(response);
        isTerminalState = this.isTerminalState(
          normalizedResponse,
          identifiedPaths.length > 0
        );
      }

      const confidence = this.calculateConfidence(
        identifiedPaths,
        normalizedResponse
      );

      logger.info("Completed response analysis", {
        businessType: this.businessContext,
        pathsIdentified: identifiedPaths.length,
        isTerminal: isTerminalState,
        confidence,
        firstPath: identifiedPaths[0]?.substring(0, 30),
        responsePreview: response.substring(0, 50),
      });

      return {
        identifiedPaths,
        isTerminalState,
        confidence,
      };
    } catch (error) {
      logger.error("Error analyzing response", {
        error: error instanceof Error ? error.message : "Unknown error",
        response: response.substring(0, 100),
      });
      // Return safe default values on error
      return {
        identifiedPaths: [this.createDefaultSystemPrompt()],
        isTerminalState: false,
        confidence: 0.3,
      };
    }
  }

  /**
   * Detects the type of business from the response
   */
  private detectBusinessType(response: string): string {
    const normalizedResponse = response.toLowerCase();

    if (
      normalizedResponse.includes("air conditioning") ||
      normalizedResponse.includes("plumbing") ||
      normalizedResponse.includes("hvac") ||
      normalizedResponse.includes("heating")
    ) {
      return "hvac_plumbing";
    } else if (
      normalizedResponse.includes("auto") ||
      normalizedResponse.includes("car") ||
      normalizedResponse.includes("dealership") ||
      normalizedResponse.includes("vehicle")
    ) {
      return "auto_dealership";
    }

    return "general_business";
  }

  /**
   * Generates initial system prompts based on the detected business context
   */
  private async generateInitialSystemPrompts(): Promise<string[]> {
    const scenarios = this.getBusinessScenarios(this.businessContext);
    const prompts = scenarios.map((scenario) =>
      this.createSystemPrompt(scenario)
    );

    logger.info("Generated initial system prompts", {
      businessContext: this.businessContext,
      promptCount: prompts.length,
    });

    return prompts;
  }

  /**
   * Gets relevant business scenarios based on the business type
   */
  private getBusinessScenarios(businessType: string): string[] {
    switch (businessType) {
      case "hvac_plumbing":
        return [
          "AC not cooling - emergency service needed",
          "Schedule routine AC maintenance",
          "Leaking pipe emergency",
          "Water heater replacement quote",
          "New AC installation consultation",
        ];
      case "auto_dealership":
        return [
          "Interest in new vehicle purchase",
          "Used car availability check",
          "Schedule test drive",
          "Trade-in value inquiry",
          "Service department appointment",
        ];
      default:
        return ["General service inquiry"];
    }
  }

  /**
   * Creates a formatted system prompt for a specific scenario
   */
  private createSystemPrompt(scenario: string): string {
    return `You are a customer calling about ${scenario}.
When the agent answers:
1. Clearly state your needs related to ${scenario}
2. Answer any questions about your situation naturally
3. Show interest in scheduling service or getting more information
4. Be ready to provide basic contact information if asked
Your goal is to explore the complete service path for ${scenario}.`;
  }

  /**
   * Creates a default system prompt for error cases
   */
  private createDefaultSystemPrompt(): string {
    return `You are a customer calling to inquire about available services.
When the agent answers:
1. Ask about their main services
2. Show interest in learning more
3. Be ready to ask follow-up questions
Your goal is to understand what services they offer.`;
  }

  /**
   * Generates follow-up system prompts based on the agent's response
   */
  private async generateFollowUpPrompts(response: string): Promise<string[]> {
    const hasConversationCues = ResponseAnalyzer.CONVERSATION_INDICATORS.some(
      (indicator) => response.toLowerCase().includes(indicator)
    );

    const prompt = `Based on this ${this.businessContext} agent's response: "${response}"
Generate 3-4 different customer scenarios that would:
1. Directly engage with the options/questions presented
2. Explore different service paths
3. Represent realistic customer situations
Keep scenarios focused and specific.`;

    const scenarios = await generateResponses(prompt, {
      temperature: hasConversationCues ? 0.7 : 0.8,
      maxResponses: hasConversationCues ? 4 : 3,
    });

    return scenarios.map((scenario) => this.createSystemPrompt(scenario));
  }

  /**
   * Checks if the response is an initial greeting
   */
  private isInitialGreeting(response: string): boolean {
    return (
      response.includes("thank you for calling") ||
      response.includes("hello") ||
      response.includes("hi there") ||
      response.includes("speaking") ||
      response.includes("welcome to") ||
      (response.includes("this is") && response.includes("how can i help"))
    );
  }

  /**
   * Determines if the response indicates end of conversation
   */
  private isTerminalState(
    response: string,
    hasIdentifiedPaths: boolean
  ): boolean {
    if (hasIdentifiedPaths) {
      return false;
    }

    const hasTerminalIndicators = ResponseAnalyzer.TERMINAL_INDICATORS.some(
      (indicator) => response.includes(indicator)
    );

    const hasConversationCues = ResponseAnalyzer.CONVERSATION_INDICATORS.some(
      (indicator) => response.includes(indicator)
    );

    return hasTerminalIndicators && !hasConversationCues;
  }

  /**
   * Calculates confidence score for the analysis
   */
  private calculateConfidence(paths: string[], response: string): number {
    let confidence = Math.min(paths.length * 0.2, 0.8);

    if (this.businessContext !== "general_business") {
      confidence += 0.1;
    }

    if (
      ResponseAnalyzer.CONVERSATION_INDICATORS.some((indicator) =>
        response.includes(indicator)
      )
    ) {
      confidence += 0.1;
    }

    if (this.isInitialGreeting(response)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}
