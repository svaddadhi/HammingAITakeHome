import logger from "../utils/logger.js";

enum NodeStatus {
  UNEXPLORED = "unexplored",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

interface CallNode {
  id: string;
  previousPrompt: string;
  responseReceived: string;
  callId: string;
  status: NodeStatus;
  children: CallNode[];
  parentId: string | null;
  timestamp: Date;
  depth: number;
  potentialPaths?: string[];
  retryCount: number;
}

/**
 * ConversationTree manages the structure and operations of the voice agent
 * conversation discovery process. It tracks all explored and unexplored paths,
 * maintains relationships between conversation nodes, and provides methods
 * for traversing and updating the conversation tree.
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
   * Initializes the tree with a root node
   * @param prompt Initial prompt used to start the conversation
   * @param callId ID of the initial call
   * @returns The created root node
   */
  public initializeRoot(prompt: string, callId: string): CallNode {
    if (this.rootNode) {
      throw new Error("Tree already initialized");
    }

    const rootNode: CallNode = {
      id: "root",
      previousPrompt: prompt,
      responseReceived: "", // Will be updated when response is received
      callId: callId,
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
    });

    return rootNode;
  }

  /**
   * Adds a new node to the tree
   * @param parentId ID of the parent node
   * @param prompt Prompt used for this node
   * @param callId Associated call ID
   * @returns The newly created node
   */
  public addNode(parentId: string, prompt: string, callId: string): CallNode {
    const parentNode = this.nodes.get(parentId);
    if (!parentNode) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    if (parentNode.depth >= this.maxDepth) {
      throw new Error(`Maximum depth ${this.maxDepth} reached`);
    }

    const newNode: CallNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      previousPrompt: prompt,
      responseReceived: "",
      callId: callId,
      status: NodeStatus.IN_PROGRESS,
      children: [],
      parentId: parentId,
      timestamp: new Date(),
      depth: parentNode.depth + 1,
      retryCount: 0,
    };

    parentNode.children.push(newNode);
    this.nodes.set(newNode.id, newNode);

    logger.info("Added new node to conversation tree", {
      nodeId: newNode.id,
      parentId,
      depth: newNode.depth,
    });

    return newNode;
  }

  /**
   * Updates a node with response information
   * @param nodeId ID of the node to update
   * @param response Response received from the voice agent
   * @param potentialPaths Potential follow-up prompts identified
   */
  public updateNodeWithResponse(
    nodeId: string,
    response: string,
    potentialPaths?: string[]
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.responseReceived = response;
    node.potentialPaths = potentialPaths;
    node.status = NodeStatus.COMPLETED;

    logger.info("Updated node with response", {
      nodeId,
      pathsIdentified: potentialPaths?.length ?? 0,
    });
  }

  /**
   * Updates the status of a node
   * @param nodeId ID of the node to update
   * @param status New status
   */
  public updateNodeStatus(nodeId: string, status: NodeStatus): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    node.status = status;
    logger.info("Updated node status", { nodeId, status });
  }

  /**
   * Gets all nodes that have unexplored potential paths
   * @returns Array of nodes with unexplored paths
   */
  public getNodesWithUnexploredPaths(): CallNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) =>
        node.status === NodeStatus.COMPLETED &&
        node.potentialPaths?.length > 0 &&
        node.depth < this.maxDepth
    );
  }

  /**
   * Gets the complete path from root to a specific node
   * @param nodeId ID of the target node
   * @returns Array of nodes representing the path
   */
  public getPathToNode(nodeId: string): CallNode[] {
    const path: CallNode[] = [];
    let currentNode = this.nodes.get(nodeId);

    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parentId
        ? this.nodes.get(currentNode.parentId)
        : null;
    }

    return path;
  }

  /**
   * Gets a node by its ID
   * @param nodeId ID of the node to retrieve
   * @returns The requested node or null if not found
   */
  public getNode(nodeId: string): CallNode | null {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Gets all nodes at a specific depth in the tree
   * @param depth The depth to search at
   * @returns Array of nodes at the specified depth
   */
  public getNodesAtDepth(depth: number): CallNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => node.depth === depth
    );
  }

  /**
   * Gets a summary of the tree's current state
   * @returns Object containing tree statistics
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
      totalNodes,
      completedNodes,
      maxDepthReached,
      maxAllowedDepth: this.maxDepth,
    };
  }

  /**
   * Gets all nodes in the tree
   * @returns Array of all nodes
   */
  public getAllNodes(): CallNode[] {
    return Array.from(this.nodes.values());
  }
}
