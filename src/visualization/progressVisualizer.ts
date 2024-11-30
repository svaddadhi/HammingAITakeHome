// src/visualization/progressVisualizer.ts

import { ConversationTree } from "../discovery/conversationTree.js";
import logger from "../utils/logger.js";
import chalk from "chalk";

interface VisualizationNode {
  id: string;
  systemPrompt: string; // Changed from 'prompt' to 'systemPrompt' for clarity
  response: string;
  status: string;
  depth: number;
  children: VisualizationNode[];
}

/**
 * ProgressVisualizer creates real-time visualizations of our voice agent discovery process.
 * It provides clear, formatted console output showing:
 * - The current conversation tree structure
 * - Active and completed conversation paths
 * - Success rates and exploration metrics
 * - Important events and milestones
 */
export class ProgressVisualizer {
  // Characters used to draw the tree structure in the console
  private static readonly TREE_CHARS = {
    vertical: "│",
    horizontal: "──",
    corner: "└",
    junction: "├",
    bullet: "●",
  };

  // Color coding for different conversation states
  private static readonly STATUS_COLORS = {
    unexplored: chalk.gray,
    "in-progress": chalk.yellow,
    completed: chalk.green,
    failed: chalk.red,
  };

  private static readonly PROMPT_DISPLAY_LENGTH = Number.MAX_SAFE_INTEGER; // Increased from 60
  private static readonly RESPONSE_DISPLAY_LENGTH = Number.MAX_SAFE_INTEGER;

  /**
   * Creates a visual representation of the current conversation tree.
   * This helps us understand how different conversation paths are related
   * and which areas have been explored.
   */
  public visualizeTree(tree: ConversationTree): void {
    // Clear console for fresh visualization
    console.clear();

    // Get the root node and prepare for visualization
    const nodes = tree.getAllNodes();
    const rootNode = nodes.find((node) => node.parentId === null);

    if (!rootNode) {
      logger.warn("No conversation data to visualize");
      return;
    }

    // Print header with current timestamp
    console.log(chalk.bold("\n=== Voice Agent Discovery Progress ==="));
    console.log(chalk.dim(`Time: ${new Date().toLocaleString()}\n`));

    // Convert the tree data for visualization
    const visualTree = this.convertToVisualNode(rootNode, nodes);

    // Render the tree structure
    this.renderNode(visualTree, "", true);

    // Print summary statistics
    this.printTreeSummary(tree);
  }

  /**
   * Shows the current progress of our discovery process, including
   * active conversations and success metrics.
   */
  public visualizeProgress(state: any): void {
    console.log(chalk.bold("\n=== Discovery Metrics ==="));

    // Active conversations
    console.log(chalk.yellow(`Active Conversations: ${state.activeCallCount}`));

    // Success metrics
    console.log(
      chalk.green(`Successfully Completed: ${state.completedCallCount}`)
    );

    // Failed attempts
    console.log(chalk.red(`Failed Attempts: ${state.failedCallCount}`));

    // Calculate and show success rate
    const totalAttempts = state.completedCallCount + state.failedCallCount;
    const successRate =
      totalAttempts > 0
        ? ((state.completedCallCount / totalAttempts) * 100).toFixed(1)
        : 0;
    console.log(chalk.blue(`Success Rate: ${successRate}%`));

    // Time tracking
    console.log(
      chalk.dim(`Last Update: ${state.lastUpdateTimestamp.toLocaleString()}`)
    );

    console.log(chalk.dim("=====================================\n"));
  }

  /**
   * Logs significant events during the discovery process with detailed context.
   * This helps track important milestones and debug issues.
   */
  public logConversationEvent(
    nodeId: string,
    event: string,
    details: any
  ): void {
    const timestamp = new Date().toISOString();
    const eventColor = this.getEventColor(event);

    console.log(eventColor(`\n[${timestamp}] ${event.toUpperCase()}`));
    console.log(chalk.dim(`Node: ${nodeId}`));

    // Format details for better readability
    Object.entries(details).forEach(([key, value]) => {
      if (typeof value === "string") {
        console.log(
          chalk.dim(`${key}: `) +
            this.truncateText(
              value as string,
              ProgressVisualizer.RESPONSE_DISPLAY_LENGTH
            )
        );
      } else {
        console.log(chalk.dim(`${key}: `) + value);
      }
    });

    console.log(chalk.dim("---"));
  }

  /**
   * Converts our conversation tree data into a format suitable for visualization.
   */
  private convertToVisualNode(node: any, allNodes: any[]): VisualizationNode {
    const children = allNodes.filter((n) => n.parentId === node.id);
    return {
      id: node.id,
      systemPrompt: node.systemPrompt,
      response: node.responseReceived,
      status: node.status,
      depth: node.depth,
      children: children.map((child) =>
        this.convertToVisualNode(child, allNodes)
      ),
    };
  }

  /**
   * Renders a node in the tree visualization with appropriate formatting and colors.
   */
  private renderNode(
    node: VisualizationNode,
    prefix: string,
    isLast: boolean
  ): void {
    const connector = isLast
      ? ProgressVisualizer.TREE_CHARS.corner
      : ProgressVisualizer.TREE_CHARS.junction;

    // Color the node based on its status
    const statusColor =
      ProgressVisualizer.STATUS_COLORS[
        node.status as keyof typeof ProgressVisualizer.STATUS_COLORS
      ] || chalk.white;

    // Render the node with its system prompt
    console.log(
      `${prefix}${connector}${ProgressVisualizer.TREE_CHARS.horizontal}` +
        statusColor(
          `[${node.status}] ${this.truncateText(
            node.systemPrompt,
            ProgressVisualizer.PROMPT_DISPLAY_LENGTH
          )}`
        )
    );

    // Show the response if available
    if (node.response) {
      console.log(
        `${prefix}${isLast ? " " : ProgressVisualizer.TREE_CHARS.vertical}   ` +
          chalk.dim(
            `Response: "${this.truncateText(
              node.response,
              ProgressVisualizer.RESPONSE_DISPLAY_LENGTH
            )}"`
          )
      );
    }

    // Render child nodes
    const childPrefix =
      prefix +
      (isLast ? "    " : ProgressVisualizer.TREE_CHARS.vertical + "   ");
    node.children.forEach((child, index) => {
      this.renderNode(child, childPrefix, index === node.children.length - 1);
    });
  }

  /**
   * Prints summary statistics about our discovery progress.
   */
  private printTreeSummary(tree: ConversationTree): void {
    const summary = tree.getTreeSummary();

    console.log(chalk.bold("\n=== Discovery Summary ==="));
    console.log(chalk.blue(`Total Conversation Paths: ${summary.totalPaths}`));
    console.log(chalk.green(`Completed Paths: ${summary.completedPaths}`));
    console.log(
      chalk.yellow(
        `Current Depth: ${summary.maxDepthReached}/${summary.maxAllowedDepth}`
      )
    );

    // Calculate and show completion percentage
    const completionRate = (
      (summary.completedPaths / summary.totalPaths) *
      100
    ).toFixed(1);
    console.log(chalk.cyan(`Completion Rate: ${completionRate}%`));

    console.log(chalk.dim("======================\n"));
  }

  /**
   * Gets the appropriate color for different event types.
   */
  private getEventColor(event: string): chalk.ChalkFunction {
    switch (event.toLowerCase()) {
      case "conversation completed":
        return chalk.green;
      case "conversation failed":
        return chalk.red;
      case "new path discovered":
        return chalk.blue;
      default:
        return chalk.white;
    }
  }

  /**
   * Truncates text to a specified length while preserving readability.
   */
  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
      ? `${text.substring(0, maxLength - 3)}...`
      : text;
  }
}
