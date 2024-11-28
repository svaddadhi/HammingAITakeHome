import logger from "../utils/logger.js";

interface AnalysisResult {
  identifiedPaths: string[];
  isTerminalState: boolean;
  confidence: number;
}

/**
 * ResponseAnalyzer processes transcribed voice agent responses to identify
 * potential conversation paths and determine appropriate follow-up prompts.
 * It uses simple heuristics to identify meaningful paths while avoiding
 * redundant explorations.
 */
export class ResponseAnalyzer {
  // Common phrases that indicate options or choices
  private static readonly OPTION_INDICATORS = [
    "would you like",
    "you can",
    "options are",
    "we offer",
    "we can",
    "choose",
    "select",
    "either",
  ];

  // Phrases that might indicate a terminal state
  private static readonly TERMINAL_INDICATORS = [
    "goodbye",
    "thank you for calling",
    "have a nice day",
    "is there anything else",
    "end of our call",
  ];

  /**
   * Analyzes a transcribed response to identify potential conversation paths
   * @param response - Transcribed text from the voice agent
   * @returns Analysis result containing identified paths and state information
   */
  public async analyzeResponse(response: string): Promise<AnalysisResult> {
    try {
      const normalizedResponse = response.toLowerCase();

      // Check for terminal state
      const isTerminalState = this.isTerminalState(normalizedResponse);

      // Identify potential paths
      const identifiedPaths = await this.identifyPaths(normalizedResponse);

      // Calculate confidence based on identified patterns
      const confidence = this.calculateConfidence(identifiedPaths);

      logger.info("Response analysis completed", {
        pathsIdentified: identifiedPaths.length,
        isTerminal: isTerminalState,
        confidence,
      });

      return {
        identifiedPaths,
        isTerminalState,
        confidence,
      };
    } catch (error) {
      logger.error("Error analyzing response", {
        error: error instanceof Error ? error.message : "Unknown error",
        response: response.substring(0, 100), // Log first 100 chars for context
      });
      throw error;
    }
  }

  /**
   * Generates appropriate follow-up prompts based on identified paths
   * @param paths - Array of identified potential paths
   * @returns Array of follow-up prompts
   */
  public generateFollowUpPrompts(paths: string[]): string[] {
    return paths.map((path) => {
      // Generate contextually appropriate prompts based on the path
      if (path.includes("schedule") || path.includes("appointment")) {
        return "I'd like to schedule an appointment";
      }
      if (path.includes("pricing") || path.includes("cost")) {
        return "Can you tell me about your pricing?";
      }
      if (path.includes("service") || path.includes("repair")) {
        return "What services do you offer?";
      }
      // Default to a simple selection of the path
      return `I'm interested in ${path}`;
    });
  }

  /**
   * Identifies potential conversation paths from the response
   * @param response - Normalized response text
   * @returns Array of identified paths
   * @private
   */
  private async identifyPaths(response: string): Promise<string[]> {
    const paths = new Set<string>();

    // Check for direct option indicators
    for (const indicator of ResponseAnalyzer.OPTION_INDICATORS) {
      if (response.includes(indicator)) {
        const startIndex = response.indexOf(indicator) + indicator.length;
        const segment = response.slice(startIndex, startIndex + 100); // Look at next 100 chars

        // Split by common delimiters and clean up
        const options = segment
          .split(/[,.]/)
          .map((opt) => opt.trim())
          .filter((opt) => opt.length > 3) // Filter out very short segments
          .filter((opt) => !opt.startsWith("or ") && !opt.startsWith("and ")); // Clean up connectors

        options.forEach((opt) => paths.add(opt));
      }
    }

    // Look for specific service-related keywords
    const serviceKeywords = [
      "repair",
      "maintenance",
      "installation",
      "service",
      "appointment",
    ];
    for (const keyword of serviceKeywords) {
      if (response.includes(keyword)) {
        const words = response.split(" ");
        const keywordIndex = words.findIndex((w) => w.includes(keyword));
        if (keywordIndex >= 0) {
          // Look at words around the keyword
          const contextRange = 3; // Words before and after
          const start = Math.max(0, keywordIndex - contextRange);
          const end = Math.min(words.length, keywordIndex + contextRange + 1);
          const context = words.slice(start, end).join(" ");
          paths.add(context.trim());
        }
      }
    }

    return Array.from(paths);
  }

  /**
   * Checks if the response indicates a terminal state
   * @param response - Normalized response text
   * @returns boolean indicating if this is a terminal state
   * @private
   */
  private isTerminalState(response: string): boolean {
    return ResponseAnalyzer.TERMINAL_INDICATORS.some((indicator) =>
      response.includes(indicator)
    );
  }

  /**
   * Calculates confidence score for the analysis
   * @param identifiedPaths - Array of identified paths
   * @returns confidence score between 0 and 1
   * @private
   */
  private calculateConfidence(identifiedPaths: string[]): number {
    // Simple confidence calculation based on number of paths identified
    // and presence of clear option indicators
    const pathConfidence = Math.min(identifiedPaths.length * 0.2, 0.8);
    const hasOptionIndicators = ResponseAnalyzer.OPTION_INDICATORS.some(
      (indicator) => identifiedPaths.some((path) => path.includes(indicator))
    );

    return hasOptionIndicators
      ? Math.min(pathConfidence + 0.2, 1.0)
      : pathConfidence;
  }
}
