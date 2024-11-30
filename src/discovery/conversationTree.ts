// src/discovery/conversationTree.ts

import logger from "../utils/logger.js";

// We define the possible states a node can be in during exploration
enum NodeStatus {
  UNEXPLORED = "unexplored",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

// We've simplified the node interface to focus on essential properties
interface CallNode {
  id: string;
  // The system prompt that was used to initiate this conversation path
  systemPrompt: string;
  // The transcribed response received from the agent
  responseReceived: string;
  // ID of the call associated with this node
  callId: string;
  status: NodeStatus;
  children: CallNode[];
  parentId: string | null;
  timestamp: Date;
  depth: number;
  // Potential paths identified for further exploration
  potentialPrompts?: string[];
  retryCount: number;
}

/**
 * ConversationTree manages the structure and traversal of our voice agent
 * conversation discovery process. It maintains a tree where each node represents
 * a specific interaction with the voice agent, tracking how different system
 * prompts lead to different conversation paths.
 */
export class ConversationTree {
  private nodes: Map<string, CallNode>;
  private rootNode: CallNode | null;
  private maxDepth: number;

  constructor(maxDepth: number = 10) {
    this.nodes = new Map();
    this.rootNode = null;
    this.maxDepth = maxDepth;
  }

  /**
   * Initializes the tree with a root node representing our first interaction
   */
  public initializeRoot(systemPrompt: string, callId: string): CallNode {
    if (this.rootNode) {
      throw new Error("Tree already initialized");
    }

    const rootNode: CallNode = {
      id: "root",
      systemPrompt,
      responseReceived: "",
      callId,
      status: NodeStatus.IN_PROGRESS,
      children: [],
      parentId: null,
      timestamp: new Date(),
      depth: 0,
      retryCount: 0,
    };

    this.rootNode = rootNode;
    this.nodes.set(rootNode.id, rootNode);

    logger.info("Conversation tree initialized with root node", {
      nodeId: rootNode.id,
      callId,
      systemPrompt: systemPrompt.substring(0, 50),
    });

    return rootNode;
  }

  /**
   * Adds a new conversation path to explore by creating a new node
   */
  public addNode(
    parentId: string,
    systemPrompt: string,
    callId: string
  ): CallNode {
    const parentNode = this.nodes.get(parentId);
    if (!parentNode) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    if (parentNode.depth >= this.maxDepth) {
      throw new Error(`Maximum depth ${this.maxDepth} reached`);
    }

    const newNode: CallNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      systemPrompt,
      responseReceived: "",
      callId,
      status: NodeStatus.IN_PROGRESS,
      children: [],
      parentId,
      timestamp: new Date(),
      depth: parentNode.depth + 1,
      retryCount: 0,
    };

    parentNode.children.push(newNode);
    this.nodes.set(newNode.id, newNode);

    logger.info("Added new conversation path node", {
      nodeId: newNode.id,
      parentId,
      depth: newNode.depth,
      systemPromptPreview: systemPrompt.substring(0, 50),
    });

    return newNode;
  }

  /**
   * Updates a node with the response received from the voice agent
   */
  public updateNodeWithResponse(
    nodeId: string,
    response: string,
    potentialPrompts?: string[]
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.responseReceived = response;
    node.potentialPrompts = potentialPrompts;
    node.status = NodeStatus.COMPLETED;

    logger.info("Updated node with agent response", {
      nodeId,
      responsePreview: response.substring(0, 50),
      potentialPathsCount: potentialPrompts?.length ?? 0,
    });
  }

  /**
   * Updates the status of a conversation path
   */
  public updateNodeStatus(nodeId: string, status: NodeStatus): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.status = status;
    logger.info("Updated conversation path status", {
      nodeId,
      status,
      depth: node.depth,
    });
  }

  /**
   * Finds all nodes that have unexplored potential conversation paths
   */
  public getNodesWithUnexploredPaths(): CallNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) =>
        node.status === NodeStatus.COMPLETED &&
        node.potentialPrompts?.length > 0 &&
        node.depth < this.maxDepth
    );
  }

  /**
   * Gets the complete conversation history from root to a specific node
   */
  public getPathToNode(nodeId: string): CallNode[] {
    const path: CallNode[] = [];
    let currentNode = this.nodes.get(nodeId);

    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId
        ? this.nodes.get(currentNode.parentId) ?? undefined
        : undefined;
    }

    return path;
  }

  /**
   * Gets all nodes at a specific depth in our conversation exploration
   */
  public getNodesAtDepth(depth: number): CallNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => node.depth === depth
    );
  }

  /**
   * Provides a summary of our conversation exploration progress
   */
  public getTreeSummary() {
    const totalNodes = this.nodes.size;
    const completedNodes = Array.from(this.nodes.values()).filter(
      (node) => node.status === NodeStatus.COMPLETED
    ).length;
    const maxDepthReached = Math.max(
      ...Array.from(this.nodes.values()).map((node) => node.depth)
    );

    return {
      totalPaths: totalNodes,
      completedPaths: completedNodes,
      maxDepthReached,
      maxAllowedDepth: this.maxDepth,
    };
  }

  /**
   * Gets all explored conversation paths
   */
  public getAllNodes(): CallNode[] {
    return Array.from(this.nodes.values());
  }
}
