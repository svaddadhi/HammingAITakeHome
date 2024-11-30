// src/orchestrator/discoveryOrchestrator.ts

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
}

interface DiscoveryState {
  isRunning: boolean;
  activeCallCount: number;
  completedCallCount: number;
  failedCallCount: number;
  lastUpdateTimestamp: Date;
}

/**
 * DiscoveryOrchestrator manages the systematic exploration of voice agent capabilities.
 * It coordinates between different components to:
 * 1. Initiate conversations with different system prompts
 * 2. Process agent responses to identify new paths
 * 3. Build a comprehensive map of possible conversation flows
 * 4. Track exploration progress and manage concurrent calls
 */
export class DiscoveryOrchestrator {
  private readonly callManager: CallManager;
  private readonly conversationTree: ConversationTree;
  private readonly responseAnalyzer: ResponseAnalyzer;
  private readonly config: DiscoveryConfig;
  private state: DiscoveryState;
  private readonly visualizer: ProgressVisualizer;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  constructor(callManager: CallManager, config: DiscoveryConfig) {
    this.callManager = callManager;
    this.config = config;
    this.conversationTree = new ConversationTree(config.maxDepth);
    this.responseAnalyzer = new ResponseAnalyzer();
    this.visualizer = new ProgressVisualizer();

    this.state = {
      isRunning: false,
      activeCallCount: 0,
      completedCallCount: 0,
      failedCallCount: 0,
      lastUpdateTimestamp: new Date(),
    };
  }

  /**
   * Begins the discovery process by initiating the first conversation
   * with an initial system prompt. This starts our exploration of the
   * voice agent's capabilities.
   */
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

      // Start with initial conversation
      const initialSystemPrompt = this.createInitialSystemPrompt();
      const callId = await this.callManager.startCall(
        this.config.phoneNumber,
        initialSystemPrompt,
        this.config.webhookUrl
      );

      // Initialize our conversation tree with this first interaction
      this.conversationTree.initializeRoot(initialSystemPrompt, callId);
      this.state.activeCallCount++;

      logger.info("Initial conversation started", {
        callId,
        systemPromptPreview: initialSystemPrompt.substring(0, 50),
      });
    } catch (error) {
      this.state.isRunning = false;
      logger.error("Failed to start discovery process", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Creates the initial system prompt that starts our discovery process.
   * This prompt is designed to elicit information about available services.
   */
  private createInitialSystemPrompt(): string {
    return `You are a customer making your first call to this business.
When the agent answers:
1. Express general interest in learning about their services
2. Be ready to ask follow-up questions about specific services
3. Show interest but avoid committing to any service yet
Your goal is to understand what services they offer and how they handle initial inquiries.`;
  }

  /**
   * Processes a completed call by analyzing the response and planning
   * the next conversations to explore.
   */
  public async handleCallCompleted(
    callId: string,
    response: string
  ): Promise<void> {
    try {
      const node = this.findNodeByCallId(callId);
      if (!node) {
        throw new Error(`No conversation node found for call ${callId}`);
      }

      // Analyze the response to identify new conversation paths to explore
      const analysis = await this.responseAnalyzer.analyzeResponse(response);
      this.conversationTree.updateNodeWithResponse(
        node.id,
        response,
        analysis.identifiedPaths
      );

      // Update discovery state
      this.state.activeCallCount--;
      this.state.completedCallCount++;
      this.state.lastUpdateTimestamp = new Date();

      // Visualize our progress
      this.visualizer.visualizeTree(this.conversationTree);
      this.visualizer.visualizeProgress(this.state);
      this.visualizer.logConversationEvent(node.id, "Conversation Completed", {
        responsePreview: response.substring(0, 100),
        newPathsIdentified: analysis.identifiedPaths.length,
      });

      // Continue exploration with newly discovered paths
      if (!analysis.isTerminalState) {
        await this.exploreNextPaths();
      }

      logger.info("Successfully processed completed conversation", {
        callId,
        nodeId: node.id,
        newPathsIdentified: analysis.identifiedPaths.length,
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

  /**
   * Finds the conversation node associated with a specific call
   */
  private findNodeByCallId(callId: string) {
    return this.conversationTree
      .getAllNodes()
      .find((node) => node.callId === callId);
  }

  /**
   * Explores the next set of conversation paths based on our discoveries.
   * This method manages the concurrent exploration of different paths while
   * staying within our configured limits.
   */
  private async exploreNextPaths(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      const unexploredNodes =
        this.conversationTree.getNodesWithUnexploredPaths();

      for (const node of unexploredNodes) {
        if (this.state.activeCallCount >= this.config.maxConcurrentCalls) {
          logger.info("Reached maximum concurrent conversations", {
            activeCount: this.state.activeCallCount,
            maximum: this.config.maxConcurrentCalls,
          });
          break;
        }

        const nextPrompt = node.potentialPrompts?.[0];
        if (!nextPrompt) continue;

        // Remove this prompt from our queue since we're about to use it
        node.potentialPrompts = node.potentialPrompts?.slice(1);

        try {
          // Start a new conversation with this prompt
          const callId = await this.callManager.startCall(
            this.config.phoneNumber,
            nextPrompt,
            this.config.webhookUrl
          );

          // Add this new conversation path to our tree
          const newNode = this.conversationTree.addNode(
            node.id,
            nextPrompt,
            callId
          );

          this.state.activeCallCount++;
          this.state.lastUpdateTimestamp = new Date();

          // Update visualization
          this.visualizer.visualizeTree(this.conversationTree);
          this.visualizer.visualizeProgress(this.state);

          logger.info("Started exploration of new conversation path", {
            parentNodeId: node.id,
            newNodeId: newNode.id,
            callId,
            promptPreview: nextPrompt.substring(0, 50),
          });

          // Small delay between calls to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          logger.error("Failed to explore conversation path", {
            error: error instanceof Error ? error.message : "Unknown error",
            parentNodeId: node.id,
            promptPreview: nextPrompt.substring(0, 50),
          });

          // Return the prompt to the queue for potential retry
          if (node.potentialPrompts) {
            node.potentialPrompts.push(nextPrompt);
          } else {
            node.potentialPrompts = [nextPrompt];
          }
        }
      }

      logger.info("Completed exploration cycle", {
        activeConversations: this.state.activeCallCount,
        completedConversations: this.state.completedCallCount,
        remainingUnexplored: unexploredNodes.length,
      });
    } catch (error) {
      logger.error("Error in path exploration process", {
        error: error instanceof Error ? error.message : "Unknown error",
        activeCallCount: this.state.activeCallCount,
      });
    }
  }

  /**
   * Handles failed calls by implementing retry logic up to a maximum
   * number of attempts.
   */
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

          const newCallId = await this.callManager.startCall(
            this.config.phoneNumber,
            node.systemPrompt,
            this.config.webhookUrl
          );

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

  /**
   * Gets the current state of the discovery process including
   * progress metrics and tree summary.
   */
  public getDiscoveryState() {
    return {
      ...this.state,
      treeSummary: this.conversationTree.getTreeSummary(),
    };
  }

  /**
   * Stops the discovery process gracefully.
   */
  public stopDiscovery(): void {
    this.state.isRunning = false;
    logger.info("Discovery process stopped", this.getDiscoveryState());
  }
}
