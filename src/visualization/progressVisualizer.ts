import { ConversationTree } from "../discovery/conversationTree.js";
import logger from "../utils/logger.js";

interface VisualizationNode {
  id: string;
  prompt: string;
  response: string;
  status: string;
  depth: number;
  children: VisualizationNode[];
}

/**
 * ProgressVisualizer handles real-time visualization of the discovery process,
 * including conversation tree structure and progress tracking.
 */
export class ProgressVisualizer {
  private static readonly TREE_CHARS = {
    vertical: "│",
    horizontal: "──",
    corner: "└",
    junction: "├",
  };

  /**
   * Generates a visual representation of the current conversation tree
   * @param tree The conversation tree to visualize
   */
  public visualizeTree(tree: ConversationTree): void {
    console.clear(); // Clear console for fresh visualization
    const nodes = tree.getAllNodes();
    const rootNode = nodes.find((node) => node.parentId === null);

    if (!rootNode) {
      logger.warn("No root node found in conversation tree");
      return;
    }

    // Convert to visualization format
    const visualTree = this.convertToVisualNode(rootNode, nodes);

    // Print tree header
    console.log("\n=== Conversation Tree Visualization ===\n");

    // Render tree structure
    this.renderNode(visualTree, "", true);

    // Print summary
    this.printTreeSummary(tree);
  }

  /**
   * Displays the current progress of the discovery process
   * @param state Current state of the discovery process
   */
  public visualizeProgress(state: any): void {
    console.log("\n=== Discovery Progress ===");
    console.log(`Active Calls: ${state.activeCallCount}`);
    console.log(`Completed Calls: ${state.completedCallCount}`);
    console.log(`Failed Calls: ${state.failedCallCount}`);
    console.log(`Last Update: ${state.lastUpdateTimestamp}`);
    console.log("===========================\n");
  }

  /**
   * Logs a conversation event with formatted output
   * @param nodeId ID of the conversation node
   * @param event Type of event
   * @param details Additional event details
   */
  public logConversationEvent(
    nodeId: string,
    event: string,
    details: any
  ): void {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${event.toUpperCase()}`);
    console.log(`Node: ${nodeId}`);
    console.log("Details:", JSON.stringify(details, null, 2));
    console.log("---");
  }

  /**
   * Converts a tree node to visualization format
   * @param node Current node
   * @param allNodes All nodes in the tree
   * @private
   */
  private convertToVisualNode(node: any, allNodes: any[]): VisualizationNode {
    const children = allNodes.filter((n) => n.parentId === node.id);
    return {
      id: node.id,
      prompt: node.previousPrompt,
      response: node.responseReceived,
      status: node.status,
      depth: node.depth,
      children: children.map((child) =>
        this.convertToVisualNode(child, allNodes)
      ),
    };
  }

  /**
   * Renders a node and its children in the tree visualization
   * @param node Node to render
   * @param prefix Current prefix for tree structure
   * @param isLast Whether this is the last child in its parent
   * @private
   */
  private renderNode(
    node: VisualizationNode,
    prefix: string,
    isLast: boolean
  ): void {
    // Construct the line for this node
    const connector = isLast
      ? ProgressVisualizer.TREE_CHARS.corner
      : ProgressVisualizer.TREE_CHARS.junction;
    console.log(
      `${prefix}${connector}${ProgressVisualizer.TREE_CHARS.horizontal}` +
        `[${node.status}] ${this.truncateText(node.prompt, 40)}`
    );

    // Add response if available
    if (node.response) {
      console.log(
        `${prefix}${isLast ? " " : ProgressVisualizer.TREE_CHARS.vertical}   ` +
          `Response: "${this.truncateText(node.response, 60)}"`
      );
    }

    // Render children
    const childPrefix =
      prefix +
      (isLast ? "    " : ProgressVisualizer.TREE_CHARS.vertical + "   ");
    node.children.forEach((child, index) => {
      this.renderNode(child, childPrefix, index === node.children.length - 1);
    });
  }

  /**
   * Prints a summary of the conversation tree
   * @param tree Conversation tree
   * @private
   */
  private printTreeSummary(tree: ConversationTree): void {
    const summary = tree.getTreeSummary();
    console.log("\n=== Tree Summary ===");
    console.log(`Total Nodes: ${summary.totalNodes}`);
    console.log(`Completed Nodes: ${summary.completedNodes}`);
    console.log(`Max Depth Reached: ${summary.maxDepthReached}`);
    console.log(`Max Allowed Depth: ${summary.maxAllowedDepth}`);
    console.log("==================\n");
  }

  /**
   * Truncates text to a specified length
   * @param text Text to truncate
   * @param maxLength Maximum length
   * @private
   */
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
      ? text.substring(0, maxLength - 3) + "..."
      : text;
  }
}
