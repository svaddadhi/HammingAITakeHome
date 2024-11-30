import logger from "../utils/logger.js";
import { generateResponses } from "../utils/openai.js";

interface AnalysisResult {
  identifiedPaths: string[];
  isTerminalState: boolean;
  confidence: number;
}

interface ConversationContext {
  businessType: string;
  requestedInfo?: string[];
  servicesDiscussed?: string[];
  customerPreferences?: string[];
}

export class ResponseAnalyzer {
  private context: ConversationContext;

  private static readonly TERMINAL_INDICATORS = [
    "goodbye",
    "thank you for calling",
    "have a nice day",
    "is there anything else",
    "end of our call",
    "have a great",
    "bye",
  ];

  private static readonly INFO_REQUEST_PATTERNS = [
    { pattern: /your (name|full name)/, info: "name" },
    { pattern: /(address|location|where.*located)/, info: "address" },
    { pattern: /(phone.*number|contact.*number)/, info: "phone" },
    { pattern: /(email|e-mail)/, info: "email" },
    {
      pattern: /(existing|current|previous) customer/,
      info: "customer_status",
    },
  ];

  constructor() {
    this.context = {
      businessType: "",
      requestedInfo: [],
      servicesDiscussed: [],
      customerPreferences: [],
    };
  }

  public async analyzeResponse(response: string): Promise<AnalysisResult> {
    try {
      const normalizedResponse = response.toLowerCase();

      // Detect business type if not already set
      if (!this.context.businessType) {
        this.context.businessType = this.detectBusinessType(response);
        logger.info("Detected business type", {
          businessContext: this.context.businessType,
          responsePreview: response.substring(0, 50),
        });
      }

      this.updateConversationContext(response);

      const identifiedPaths = await this.generateContextualPrompts(response);
      const isTerminalState = this.isTerminalState(
        normalizedResponse,
        identifiedPaths.length > 0
      );

      const confidence = this.calculateConfidence(
        identifiedPaths,
        response,
        this.context
      );

      logger.info("Completed response analysis", {
        businessType: this.context.businessType,
        pathsIdentified: identifiedPaths.length,
        requestedInfo: this.context.requestedInfo,
        isTerminal: isTerminalState,
        confidence,
        firstPath: identifiedPaths[0]?.substring(0, 30),
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
      return {
        identifiedPaths: [this.createDefaultSystemPrompt()],
        isTerminalState: false,
        confidence: 0.3,
      };
    }
  }

  private updateConversationContext(response: string): void {
    const requestedInfo = ResponseAnalyzer.INFO_REQUEST_PATTERNS.filter(
      ({ pattern }) => pattern.test(response.toLowerCase())
    ).map(({ info }) => info);

    if (requestedInfo.length > 0) {
      this.context.requestedInfo = [
        ...(this.context.requestedInfo || []),
        ...requestedInfo,
      ];
    }

    const servicesDiscussed = this.extractDiscussedServices(response);
    if (servicesDiscussed.length > 0) {
      this.context.servicesDiscussed = [
        ...(this.context.servicesDiscussed || []),
        ...servicesDiscussed,
      ];
    }
  }

  private extractDiscussedServices(response: string): string[] {
    const services = new Set<string>();
    const normalizedResponse = response.toLowerCase();

    if (this.context.businessType === "hvac_plumbing") {
      if (
        normalizedResponse.includes("ac") ||
        normalizedResponse.includes("air conditioning")
      )
        services.add("ac_service");
      if (
        normalizedResponse.includes("heat") ||
        normalizedResponse.includes("heating")
      )
        services.add("heating");
      if (
        normalizedResponse.includes("plumb") ||
        normalizedResponse.includes("pipe")
      )
        services.add("plumbing");
      if (normalizedResponse.includes("maintenance"))
        services.add("maintenance");
      if (normalizedResponse.includes("emergency"))
        services.add("emergency_service");
    } else if (this.context.businessType === "auto_dealership") {
      if (
        normalizedResponse.includes("new car") ||
        normalizedResponse.includes("new vehicle")
      )
        services.add("new_car_sales");
      if (
        normalizedResponse.includes("used") ||
        normalizedResponse.includes("pre-owned")
      )
        services.add("used_car_sales");
      if (
        normalizedResponse.includes("service") ||
        normalizedResponse.includes("repair")
      )
        services.add("service_department");
      if (normalizedResponse.includes("trade")) services.add("trade_in");
      if (normalizedResponse.includes("test drive")) services.add("test_drive");
    }

    return Array.from(services);
  }

  private async generateContextualPrompts(response: string): Promise<string[]> {
    const prompts: string[] = [];

    if (this.context.requestedInfo?.length) {
      prompts.push(this.createInfoProvisionPrompt());
      prompts.push(this.createInfoAvoidancePrompt());
    }

    if (this.context.servicesDiscussed?.length) {
      for (const service of this.context.servicesDiscussed) {
        prompts.push(this.createServiceSpecificPrompt(service));
      }
    }

    const aiPrompts = await this.generateAIPrompts(response);
    prompts.push(...aiPrompts);

    return prompts;
  }

  private createInfoProvisionPrompt(): string {
    const requestedInfo = this.context.requestedInfo?.join(" and ") || "";
    return `You are a customer willing to provide ${requestedInfo}.
When the agent asks:
1. Provide the requested information clearly
2. Show interest in learning about specific services
3. Ask about next steps or service options
Your goal is to understand the full service process when providing customer information.`;
  }

  private createInfoAvoidancePrompt(): string {
    return `You are a customer who prefers not to provide personal information yet.
When the agent asks:
1. Politely explain you'd like to learn about services first
2. Ask specific questions about service options and pricing
3. Express interest but maintain privacy
Your goal is to understand how the agent handles customers who prefer initial anonymity.`;
  }

  private createServiceSpecificPrompt(service: string): string {
    const serviceName = service.replace(/_/g, " ");
    return `You are a customer specifically interested in ${serviceName}.
When the agent responds:
1. Ask detailed questions about this service
2. Inquire about pricing, availability, and process
3. Show strong interest in moving forward
4. Be ready to provide information if required
Your goal is to fully understand the ${serviceName} offering and requirements.`;
  }

  private async generateAIPrompts(response: string): Promise<string[]> {
    const prompt = `Based on this ${this.context.businessType} agent's response: "${response}"
Generate 2-3 different customer scenarios that would:
1. Naturally follow up on specific points mentioned
2. Explore different aspects of the services discussed
3. Represent realistic customer situations
Keep scenarios focused and specific to the actual conversation.`;

    return await generateResponses(prompt, {
      temperature: 0.7,
      maxResponses: 3,
    });
  }

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

  private isTerminalState(
    response: string,
    hasIdentifiedPaths: boolean
  ): boolean {
    if (hasIdentifiedPaths) {
      return false;
    }

    return ResponseAnalyzer.TERMINAL_INDICATORS.some((indicator) =>
      response.includes(indicator)
    );
  }

  private createDefaultSystemPrompt(): string {
    return `You are a customer calling to inquire about available services.
When the agent answers:
1. Ask about their main services
2. Show interest in learning more
3. Be ready to ask follow-up questions
Your goal is to understand what services they offer.`;
  }

  private calculateConfidence(
    paths: string[],
    response: string,
    context: ConversationContext
  ): number {
    let confidence = Math.min(paths.length * 0.2, 0.8);

    // Increase confidence based on context richness
    if (context.businessType !== "general_business") confidence += 0.1;
    if ((context.requestedInfo?.length ?? 0) > 0) confidence += 0.05;
    if ((context.servicesDiscussed?.length ?? 0) > 0) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }
}
