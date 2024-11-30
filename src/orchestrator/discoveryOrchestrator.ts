import logger from "../utils/logger.js";
import { CallManager } from "../call-manager/client.js";
import { ConversationTree } from "../discovery/conversationTree.js";
import { ResponseAnalyzer } from "../analyzer/responseAnalyzer.js";
import { ProgressVisualizer } from "../visualization/progressVisualizer.js";

interface DiscoveryConfig {
  maxDepth: number;
  maxConcurrentCalls: number;
  initialPrompt: string;
  phoneNumber: string;
  webhookUrl: string;
  minTimeBetweenCalls: number;
  maxCallDuration: number;
  retryDelayMs: number;
}

interface DiscoveryState {
  isRunning: boolean;
  activeCallCount: number;
  completedCallCount: number;
  failedCallCount: number;
  lastUpdateTimestamp: Date;
  exploredThemes: Set<string>;
  activeThemes: Set<string>;
  lastCallTime: number;
}

const DEFAULT_CONFIG: DiscoveryConfig = {
  maxDepth: 5,
  maxConcurrentCalls: 3,
  minTimeBetweenCalls: 500,
  maxCallDuration: 600000, // 10 minutes
  retryDelayMs: 1000,
  initialPrompt:
    "You are a customer calling to learn about available services.",
  phoneNumber: "",
  webhookUrl: "",
};

export class DiscoveryOrchestrator {
  private readonly callManager: CallManager;
  private readonly conversationTree: ConversationTree;
  private readonly responseAnalyzer: ResponseAnalyzer;
  private readonly config: DiscoveryConfig;
  private state: DiscoveryState;
  private readonly visualizer: ProgressVisualizer;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly callQueue: Array<{
    parentId: string;
    prompt: string;
    priority: number;
  }> = [];

  constructor(callManager: CallManager, config: Partial<DiscoveryConfig>) {
    this.callManager = callManager;

    if (!config.phoneNumber || !config.webhookUrl) {
      throw new Error("phoneNumber and webhookUrl are required in config");
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.conversationTree = new ConversationTree(this.config.maxDepth);
    this.responseAnalyzer = new ResponseAnalyzer();
    this.visualizer = new ProgressVisualizer();

    this.state = {
      isRunning: false,
      activeCallCount: 0,
      completedCallCount: 0,
      failedCallCount: 0,
      lastUpdateTimestamp: new Date(),
      exploredThemes: new Set(),
      activeThemes: new Set(),
      lastCallTime: 0,
    };
  }

  public async startDiscovery(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error("Discovery process is already running");
    }

    try {
      logger.info("Starting voice agent discovery process", {
        phoneNumber: this.config.phoneNumber,
        maxDepth: this.config.maxDepth,
        maxConcurrentCalls: this.config.maxConcurrentCalls,
      });

      this.state.isRunning = true;
      this.state.lastUpdateTimestamp = new Date();

      const initialSystemPrompt = this.createInitialSystemPrompt();
      const callId = await this.initiateCall(initialSystemPrompt);

      this.conversationTree.initializeRoot(initialSystemPrompt, callId);
      this.state.activeCallCount++;

      this.processCallQueue();
    } catch (error) {
      this.state.isRunning = false;
      logger.error("Failed to start discovery process", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  private createInitialSystemPrompt(): string {
    return `You are a customer making your first call to this business.
When the agent answers:
1. Express general interest in learning about their services
2. Ask clear questions about their primary service offerings
3. Show interest but avoid committing to any service yet
Your goal is to understand what services they offer and how they handle initial inquiries.`;
  }

  public async handleCallCompleted(
    callId: string,
    response: string
  ): Promise<void> {
    try {
      const node = this.findNodeByCallId(callId);
      if (!node) {
        throw new Error(`No conversation node found for call ${callId}`);
      }

      const analysis = await this.responseAnalyzer.analyzeResponse(response);

      const newThemes: Set<string> =
        this.conversationTree.updateNodeWithResponse(
          node.id,
          response,
          analysis.identifiedPaths
        );

      this.updateStateAfterCall(newThemes);

      this.updateVisualization(node.id, response, analysis);

      if (!analysis.isTerminalState) {
        this.queueNewPaths(node.id, analysis.identifiedPaths);
      }

      logger.info("Successfully processed completed conversation", {
        callId,
        nodeId: node.id,
        newPathsIdentified: analysis.identifiedPaths.length,
        newThemes: Array.from(newThemes),
        isTerminal: analysis.isTerminalState,
      });
    } catch (error) {
      logger.error("Error processing completed conversation", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });
      this.state.failedCallCount++;
    }
  }

  private async initiateCall(prompt: string): Promise<string> {
    const now = Date.now();
    const timeSinceLastCall = now - this.state.lastCallTime;

    if (timeSinceLastCall < this.config.minTimeBetweenCalls) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.minTimeBetweenCalls - timeSinceLastCall)
      );
    }

    const callId = await this.callManager.startCall(
      this.config.phoneNumber,
      prompt,
      this.config.webhookUrl
    );

    this.state.lastCallTime = Date.now();
    return callId;
  }

  private updateStateAfterCall(newThemes: Set<string>): void {
    this.state.activeCallCount--;
    this.state.completedCallCount++;
    this.state.lastUpdateTimestamp = new Date();

    newThemes.forEach((theme) => this.state.exploredThemes.add(theme));

    newThemes.forEach((theme) => this.state.activeThemes.delete(theme));
  }

  private updateVisualization(
    nodeId: string,
    response: string,
    analysis: any
  ): void {
    this.visualizer.visualizeTree(this.conversationTree);
    this.visualizer.visualizeProgress(this.state);
    this.visualizer.logConversationEvent(nodeId, "Conversation Completed", {
      responsePreview: response.substring(0, 100),
      newPathsIdentified: analysis.identifiedPaths.length,
      exploredThemes: Array.from(this.state.exploredThemes),
      activeThemes: Array.from(this.state.activeThemes),
    });
  }

  private queueNewPaths(parentId: string, paths: string[]): void {
    paths.forEach((prompt, index) => {
      const priority = this.calculatePathPriority(prompt);
      this.callQueue.push({ parentId, prompt, priority });
    });

    this.callQueue.sort((a, b) => b.priority - a.priority);
  }

  private calculatePathPriority(prompt: string): number {
    let priority = 0;

    const promptThemes = this.extractThemes(prompt);
    const newThemes = Array.from(promptThemes).filter(
      (theme) => !this.state.exploredThemes.has(theme)
    );
    priority += newThemes.length * 2;

    if (prompt.toLowerCase().includes("emergency")) {
      priority += 3;
    }

    const activeThemeOverlap = Array.from(promptThemes).filter((theme) =>
      this.state.activeThemes.has(theme)
    );
    priority -= activeThemeOverlap.length;

    return priority;
  }

  private async processCallQueue(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      while (
        this.state.activeCallCount < this.config.maxConcurrentCalls &&
        this.callQueue.length > 0
      ) {
        const nextCall = this.callQueue.shift();
        if (!nextCall) break;

        try {
          const callId = await this.initiateCall(nextCall.prompt);
          const newNode = this.conversationTree.addNode(
            nextCall.parentId,
            nextCall.prompt,
            callId
          );

          this.state.activeCallCount++;
          this.updateActiveThemes(nextCall.prompt);
        } catch (error) {
          logger.error("Failed to initiate queued call", {
            error: error instanceof Error ? error.message : "Unknown error",
            prompt: nextCall.prompt.substring(0, 50),
          });

          if (this.shouldRetryCall(nextCall)) {
            this.callQueue.push({
              ...nextCall,
              priority: nextCall.priority - 1,
            });
          }
        }
      }
    } finally {
      // Schedule next queue processing
      setTimeout(
        () => this.processCallQueue(),
        this.config.minTimeBetweenCalls
      );
    }
  }

  private shouldRetryCall(call: { prompt: string; priority: number }): boolean {
    return call.priority > -2; // Allow up to 3 retries with decreasing priority
  }

  private updateActiveThemes(prompt: string): void {
    const themes = this.extractThemes(prompt);
    themes.forEach((theme) => this.state.activeThemes.add(theme));
  }

  private extractThemes(text: string): Set<string> {
    const themes = new Set<string>();
    const normalized = text.toLowerCase();

    if (normalized.includes("emergency")) themes.add("emergency");
    if (normalized.includes("maintenance")) themes.add("maintenance");
    if (normalized.includes("repair")) themes.add("repair");
    if (normalized.includes("installation")) themes.add("installation");
    if (normalized.includes("quote")) themes.add("quote");

    if (normalized.includes("name") || normalized.includes("address")) {
      themes.add("personal_info");
    }
    if (normalized.includes("schedule") || normalized.includes("appointment")) {
      themes.add("scheduling");
    }

    return themes;
  }

  private findNodeByCallId(callId: string) {
    return this.conversationTree
      .getAllNodes()
      .find((node) => node.callId === callId);
  }

  public async handleCallFailed(callId: string): Promise<void> {
    try {
      const node = this.findNodeByCallId(callId);
      if (node) {
        const retryCount = node.retryCount || 0;
        if (retryCount < this.MAX_RETRY_ATTEMPTS) {
          logger.info("Retrying failed conversation", {
            callId,
            retryAttempt: retryCount + 1,
          });

          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelayMs * (retryCount + 1))
          );

          const newCallId = await this.initiateCall(node.systemPrompt);
          node.callId = newCallId;
          node.retryCount = retryCount + 1;
        } else {
          logger.warn("Maximum retry attempts reached", {
            callId,
            maxAttempts: this.MAX_RETRY_ATTEMPTS,
          });
          this.state.failedCallCount++;
        }
      }

      this.state.activeCallCount--;
      this.state.lastUpdateTimestamp = new Date();
    } catch (error) {
      logger.error("Error handling failed call", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });
    }
  }

  public getDiscoveryState() {
    return {
      ...this.state,
      treeSummary: this.conversationTree.getTreeSummary(),
      queueLength: this.callQueue.length,
      exploredThemes: Array.from(this.state.exploredThemes),
      activeThemes: Array.from(this.state.activeThemes),
    };
  }

  public stopDiscovery(): void {
    this.state.isRunning = false;
    logger.info("Discovery process stopped", this.getDiscoveryState());
  }
}
