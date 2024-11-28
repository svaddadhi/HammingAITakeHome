import logger from "../utils/logger.js";
import { CallManager } from "../call-manager/client.js";
import { ConversationTree } from "../discovery/conversationTree.js";
import { WebhookHandler } from "../webhook/index.js";

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
}

/**
 * DiscoveryOrchestrator manages the overall process of discovering voice agent capabilities.
 * It coordinates between the CallManager, ConversationTree, and WebhookHandler to
 * systematically explore and document possible conversation paths.
 */
export class DiscoveryOrchestrator {
  private readonly callManager: CallManager;
  private readonly conversationTree: ConversationTree;
  private readonly config: DiscoveryConfig;
  private state: DiscoveryState;

  constructor(callManager: CallManager, config: DiscoveryConfig) {
    this.callManager = callManager;
    this.config = config;
    this.conversationTree = new ConversationTree(config.maxDepth);

    this.state = {
      isRunning: false,
      activeCallCount: 0,
      completedCallCount: 0,
      failedCallCount: 0,
    };
  }

  /**
   * Starts the discovery process
   * Initializes the conversation tree and begins exploring paths
   */
  public async startDiscovery(): Promise<void> {
    if (this.state.isRunning) {
      throw new Error("Discovery process is already running");
    }

    try {
      logger.info("Starting discovery process", {
        phoneNumber: this.config.phoneNumber,
        maxDepth: this.config.maxDepth,
      });

      this.state.isRunning = true;

      // Start with initial call
      const callId = await this.callManager.startCall(
        this.config.phoneNumber,
        this.config.initialPrompt,
        this.config.webhookUrl
      );

      // Initialize the conversation tree with root node
      this.conversationTree.initializeRoot(this.config.initialPrompt, callId);

      this.state.activeCallCount++;

      // Discovery continues through webhook callbacks
      logger.info("Initial call placed, awaiting response", { callId });
    } catch (error) {
      this.state.isRunning = false;
      logger.error("Failed to start discovery process", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Processes a completed call and decides on next steps
   * @param callId ID of the completed call
   * @param response Transcribed response from the call
   */
  public async handleCallCompleted(
    callId: string,
    response: string
  ): Promise<void> {
    try {
      // Find the node associated with this call
      const node = this.conversationTree
        .getAllNodes()
        .find((node) => node.callId === callId);

      if (!node) {
        throw new Error(`No node found for call ${callId}`);
      }

      // Update node with response
      const potentialPaths = await this.analyzePath(response);
      this.conversationTree.updateNodeWithResponse(
        node.id,
        response,
        potentialPaths
      );

      // Update state
      this.state.activeCallCount--;
      this.state.completedCallCount++;

      // Explore new paths if available
      await this.exploreNextPaths();
    } catch (error) {
      logger.error("Error processing completed call", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });
    }
  }

  /**
   * Analyzes a response to identify potential conversation paths
   * @param response Voice agent's response
   * @returns Array of potential follow-up prompts
   */
  private async analyzePath(response: string): Promise<string[]> {
    // TODO: Implement more sophisticated response analysis
    // For now, return a simple set of follow-up prompts
    return [
      "Tell me more about that",
      "What other options are available?",
      "Can you explain that differently?",
    ];
  }

  /**
   * Explores the next available paths in the conversation tree
   */
  private async exploreNextPaths(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      const unexploredNodes =
        this.conversationTree.getNodesWithUnexploredPaths();

      for (const node of unexploredNodes) {
        // Check if we can make more concurrent calls
        if (this.state.activeCallCount >= this.config.maxConcurrentCalls) {
          break;
        }

        // Get the next prompt to try
        const nextPrompt = node.potentialPaths?.[0];
        if (!nextPrompt) continue;

        // Remove this prompt from potential paths
        node.potentialPaths = node.potentialPaths?.slice(1);

        // Make the call
        const callId = await this.callManager.startCall(
          this.config.phoneNumber,
          nextPrompt,
          this.config.webhookUrl
        );

        // Add new node to tree
        this.conversationTree.addNode(node.id, nextPrompt, callId);
        this.state.activeCallCount++;

        logger.info("Started exploration of new path", {
          parentNodeId: node.id,
          newCallId: callId,
          prompt: nextPrompt,
        });
      }
    } catch (error) {
      logger.error("Error exploring next paths", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Handles failed calls
   * @param callId ID of the failed call
   */
  public async handleCallFailed(callId: string): Promise<void> {
    // Update state
    this.state.activeCallCount--;
    this.state.failedCallCount++;

    // Log failure
    logger.error("Call failed", { callId });

    // Optionally implement retry logic here
  }

  /**
   * Gets the current state of the discovery process
   */
  public getDiscoveryState() {
    return {
      ...this.state,
      treeSummary: this.conversationTree.getTreeSummary(),
    };
  }

  /**
   * Stops the discovery process
   */
  public stopDiscovery(): void {
    this.state.isRunning = false;
    logger.info("Discovery process stopped", this.getDiscoveryState());
  }
}
