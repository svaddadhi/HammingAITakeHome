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
 * DiscoveryOrchestrator manages the overall process of discovering voice agent capabilities.
 * It coordinates between the CallManager, ConversationTree, and ResponseAnalyzer to
 * systematically explore and document possible conversation paths.
 */
export class DiscoveryOrchestrator {
  private readonly callManager: CallManager;
  private readonly conversationTree: ConversationTree;
  private readonly responseAnalyzer: ResponseAnalyzer;
  private readonly config: DiscoveryConfig;
  private state: DiscoveryState;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly visualizer: ProgressVisualizer;

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
        maxConcurrentCalls: this.config.maxConcurrentCalls,
      });

      this.state.isRunning = true;
      this.state.lastUpdateTimestamp = new Date();

      // Start with initial call
      const callId = await this.callManager.startCall(
        this.config.phoneNumber,
        this.config.initialPrompt,
        this.config.webhookUrl
      );

      // Initialize the conversation tree with root node
      this.conversationTree.initializeRoot(this.config.initialPrompt, callId);

      this.state.activeCallCount++;

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

      // Analyze the response and update the node
      const potentialPaths = await this.analyzePath(response);
      this.conversationTree.updateNodeWithResponse(
        node.id,
        response,
        potentialPaths
      );

      // Update state
      this.state.activeCallCount--;
      this.state.completedCallCount++;
      this.state.lastUpdateTimestamp = new Date();

      // Add visualization
      this.visualizer.visualizeTree(this.conversationTree);
      this.visualizer.visualizeProgress(this.state);
      this.visualizer.logConversationEvent(node.id, "Call Completed", {
        response: response.substring(0, 100),
        potentialPaths: potentialPaths.length,
      });

      // Explore new paths if available
      await this.exploreNextPaths();

      logger.info("Successfully processed completed call", {
        callId,
        nodeId: node.id,
        potentialPathsFound: potentialPaths.length,
      });
    } catch (error) {
      logger.error("Error processing completed call", {
        error: error instanceof Error ? error.message : "Unknown error",
        callId,
      });
      this.state.failedCallCount++;
    }
  }

  /**
   * Analyzes a response to identify potential conversation paths
   * @param response Voice agent's response
   * @returns Array of potential follow-up prompts
   * @private
   */
  private async analyzePath(response: string): Promise<string[]> {
    try {
      const analysis = await this.responseAnalyzer.analyzeResponse(response);

      if (analysis.isTerminalState) {
        logger.info("Terminal state detected in response");
        return [];
      }

      if (analysis.confidence < 0.3) {
        logger.warn("Low confidence in path analysis", {
          confidence: analysis.confidence,
        });
      }

      // Generate appropriate follow-up prompts based on identified paths
      const followUpPrompts = this.responseAnalyzer.generateFollowUpPrompts(
        analysis.identifiedPaths
      );

      logger.info("Path analysis completed", {
        identifiedPaths: analysis.identifiedPaths.length,
        followUpPrompts: followUpPrompts.length,
        confidence: analysis.confidence,
      });

      return followUpPrompts;
    } catch (error) {
      logger.error("Error in path analysis", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return []; // Return empty array on error
    }
  }

  /**
   * Explores the next available paths in the conversation tree
   * @private
   */
  private async exploreNextPaths(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      const unexploredNodes =
        this.conversationTree.getNodesWithUnexploredPaths();

      for (const node of unexploredNodes) {
        // Check if we can make more concurrent calls
        if (this.state.activeCallCount >= this.config.maxConcurrentCalls) {
          logger.info(
            "Maximum concurrent calls reached, waiting for completions"
          );
          break;
        }

        // Get the next prompt to try
        const nextPrompt = node.potentialPaths?.[0];
        if (!nextPrompt) continue;

        // Remove this prompt from potential paths
        node.potentialPaths = node.potentialPaths?.slice(1);

        try {
          // Make the call
          const callId = await this.callManager.startCall(
            this.config.phoneNumber,
            nextPrompt,
            this.config.webhookUrl
          );

          // Add new node to tree
          this.conversationTree.addNode(node.id, nextPrompt, callId);
          this.state.activeCallCount++;
          this.state.lastUpdateTimestamp = new Date();

          // Add visualization update
          this.visualizer.visualizeTree(this.conversationTree);
          this.visualizer.visualizeProgress(this.state);

          logger.info("Started exploration of new path", {
            parentNodeId: node.id,
            newCallId: callId,
            prompt: nextPrompt,
          });
        } catch (error) {
          logger.error("Failed to explore path", {
            error: error instanceof Error ? error.message : "Unknown error",
            parentNodeId: node.id,
            prompt: nextPrompt,
          });
        }
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
    try {
      const node = this.conversationTree
        .getAllNodes()
        .find((node) => node.callId === callId);

      if (node) {
        // Implement retry logic
        const retryCount = node.retryCount || 0;
        if (retryCount < this.MAX_RETRY_ATTEMPTS) {
          logger.info("Retrying failed call", {
            callId,
            retryCount: retryCount + 1,
          });

          const newCallId = await this.callManager.startCall(
            this.config.phoneNumber,
            node.previousPrompt,
            this.config.webhookUrl
          );

          // Update node with new call ID and increment retry count
          node.callId = newCallId;
          node.retryCount = retryCount + 1;
        } else {
          logger.warn("Maximum retry attempts reached for call", {
            callId,
            maxAttempts: this.MAX_RETRY_ATTEMPTS,
          });
          this.state.failedCallCount++;
        }
      }

      // Update state
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
