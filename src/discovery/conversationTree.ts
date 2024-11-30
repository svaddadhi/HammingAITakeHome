import logger from "../utils/logger.js";

enum NodeStatus {
  UNEXPLORED = "unexplored",
  IN_PROGRESS = "in-progress",
  COMPLETED = "completed",
  FAILED = "failed",
}

interface CallNode {
  id: string;
  systemPrompt: string;
  responseReceived: string;
  callId: string;
  status: NodeStatus;
  children: CallNode[];
  parentId: string | null;
  timestamp: Date;
  depth: number;
  potentialPrompts?: string[];
  retryCount: number;
  pathSignature: string;
  exploredThemes: Set<string>;
}

export class ConversationTree {
  private nodes: Map<string, CallNode>;
  private rootNode: CallNode | null;
  private maxDepth: number;
  private exploredSignatures: Set<string>;
  private readonly MAX_CHILDREN_PER_NODE = 5;

  constructor(maxDepth: number = 10) {
    this.nodes = new Map();
    this.rootNode = null;
    this.maxDepth = maxDepth;
    this.exploredSignatures = new Set();
  }

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
      pathSignature: this.generatePathSignature(systemPrompt),
      exploredThemes: new Set(),
    };

    this.rootNode = rootNode;
    this.nodes.set(rootNode.id, rootNode);
    this.exploredSignatures.add(rootNode.pathSignature);

    logger.info("Conversation tree initialized with root node", {
      nodeId: rootNode.id,
      callId,
      systemPromptPreview: systemPrompt.substring(0, 50),
    });

    return rootNode;
  }

  public addNode(
    parentId: string,
    systemPrompt: string,
    callId: string
  ): CallNode {
    const parentNode = this.nodes.get(parentId);
    if (!parentNode) {
      throw new Error(`Parent node ${parentId} not found`);
    }

    if (parentNode.depth >= this.maxDepth - 1) {
      throw new Error(`Maximum depth ${this.maxDepth} reached`);
    }

    if (parentNode.children.length >= this.MAX_CHILDREN_PER_NODE) {
      throw new Error(`Maximum children limit reached for node ${parentId}`);
    }

    const pathSignature = this.generatePathSignature(systemPrompt);
    if (this.isRedundantPath(pathSignature, parentNode)) {
      throw new Error("Similar conversation path already explored");
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
      pathSignature,
      exploredThemes: new Set(this.extractThemes(systemPrompt)),
    };

    parentNode.children.push(newNode);
    this.nodes.set(newNode.id, newNode);
    this.exploredSignatures.add(pathSignature);

    logger.info("Added new conversation path node", {
      nodeId: newNode.id,
      parentId,
      depth: newNode.depth,
      pathSignature,
      themes: Array.from(newNode.exploredThemes),
    });

    return newNode;
  }

  public updateNodeWithResponse(
    nodeId: string,
    response: string,
    potentialPrompts?: string[]
  ): Set<string> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Filter out redundant prompts
    const uniquePrompts = potentialPrompts?.filter(
      (prompt) =>
        !this.isRedundantPath(this.generatePathSignature(prompt), node)
    );

    node.responseReceived = response;
    node.potentialPrompts = uniquePrompts;
    node.status = NodeStatus.COMPLETED;

    // Update and return explored themes based on response
    const responseThemes = this.extractThemes(response);
    responseThemes.forEach((theme) => node.exploredThemes.add(theme));

    logger.info("Updated node with agent response", {
      nodeId,
      responsePreview: response.substring(0, 50),
      uniquePromptsCount: uniquePrompts?.length ?? 0,
      exploredThemes: Array.from(node.exploredThemes),
    });

    return responseThemes;
  }

  public getNodesWithUnexploredPaths(): CallNode[] {
    const nodesWithPaths = Array.from(this.nodes.values()).filter(
      (node) =>
        node.status === NodeStatus.COMPLETED &&
        (node.potentialPrompts?.length ?? 0) > 0 &&
        node.depth < this.maxDepth &&
        node.children.length < this.MAX_CHILDREN_PER_NODE
    );

    return nodesWithPaths.sort((a, b) => {
      if (a.children.length !== b.children.length) {
        return a.children.length - b.children.length;
      }
      return b.exploredThemes.size - a.exploredThemes.size;
    });
  }

  private generatePathSignature(prompt: string): string {
    const normalized = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .sort()
      .join("_");
    return normalized;
  }

  private isRedundantPath(pathSignature: string, context: CallNode): boolean {
    if (this.exploredSignatures.has(pathSignature)) {
      return true;
    }

    const themes = this.extractThemes(pathSignature);
    if (themes.size === 0) {
      return false;
    }

    if (context.parentId) {
      const parent = this.nodes.get(context.parentId);
      if (parent) {
        const siblingThemes = new Set<string>();
        parent.children.forEach((child) => {
          child.exploredThemes.forEach((theme) => siblingThemes.add(theme));
        });
        return Array.from(themes).every((theme) => siblingThemes.has(theme));
      }
    }

    return false;
  }

  private extractThemes(text: string): Set<string> {
    const themes = new Set<string>();
    const normalizedText = text.toLowerCase();

    if (normalizedText.includes("emergency")) themes.add("emergency_service");
    if (normalizedText.includes("maintenance")) themes.add("maintenance");
    if (normalizedText.includes("repair")) themes.add("repair");
    if (normalizedText.includes("installation")) themes.add("installation");
    if (normalizedText.includes("quote")) themes.add("quote");
    if (normalizedText.includes("pricing")) themes.add("pricing");
    if (normalizedText.includes("name")) themes.add("personal_info");
    if (normalizedText.includes("address")) themes.add("location_info");
    if (normalizedText.includes("contact")) themes.add("contact_info");
    if (normalizedText.includes("schedule")) themes.add("scheduling");

    return themes;
  }

  public getAllNodes(): CallNode[] {
    return Array.from(this.nodes.values());
  }

  public getTreeSummary() {
    const totalNodes = this.nodes.size;
    const completedNodes = Array.from(this.nodes.values()).filter(
      (node) => node.status === NodeStatus.COMPLETED
    ).length;
    const maxDepthReached = Math.max(
      ...Array.from(this.nodes.values()).map((node) => node.depth)
    );

    const allThemes = new Set<string>();
    this.nodes.forEach((node) => {
      node.exploredThemes.forEach((theme) => allThemes.add(theme));
    });

    return {
      totalPaths: totalNodes,
      completedPaths: completedNodes,
      maxDepthReached,
      maxAllowedDepth: this.maxDepth,
      uniqueThemesExplored: allThemes.size,
      exploredThemes: Array.from(allThemes),
    };
  }
}
