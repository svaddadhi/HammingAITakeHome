import { ConversationTree } from "../discovery/conversationTree.js";
import logger from "../utils/logger.js";
import chalk, { Chalk } from "chalk";

interface VisualizationNode {
  id: string;
  systemPrompt: string;
  response: string;
  status: string;
  depth: number;
  children: VisualizationNode[];
}

export class ProgressVisualizer {
  private static readonly TREE_CHARS = {
    vertical: "│",
    horizontal: "──",
    corner: "└",
    junction: "├",
    bullet: "●",
  };

  private static readonly STATUS_COLORS = {
    unexplored: chalk.gray,
    "in-progress": chalk.yellow,
    completed: chalk.green,
    failed: chalk.red,
  };

  private static readonly PROMPT_DISPLAY_LENGTH = Number.MAX_SAFE_INTEGER; // Increased from 60
  private static readonly RESPONSE_DISPLAY_LENGTH = Number.MAX_SAFE_INTEGER;

  public visualizeTree(tree: ConversationTree): void {
    console.clear();

    const nodes = tree.getAllNodes();
    const rootNode = nodes.find((node) => node.parentId === null);

    if (!rootNode) {
      logger.warn("No conversation data to visualize");
      return;
    }

    console.log(chalk.bold("\n=== Voice Agent Discovery Progress ==="));
    console.log(chalk.dim(`Time: ${new Date().toLocaleString()}\n`));

    const visualTree = this.convertToVisualNode(rootNode, nodes);

    this.renderNode(visualTree, "", true);

    this.printTreeSummary(tree);
  }

  public visualizeProgress(state: any): void {
    console.log(chalk.bold("\n=== Discovery Metrics ==="));

    console.log(chalk.yellow(`Active Conversations: ${state.activeCallCount}`));

    console.log(
      chalk.green(`Successfully Completed: ${state.completedCallCount}`)
    );

    console.log(chalk.red(`Failed Attempts: ${state.failedCallCount}`));

    const totalAttempts = state.completedCallCount + state.failedCallCount;
    const successRate =
      totalAttempts > 0
        ? ((state.completedCallCount / totalAttempts) * 100).toFixed(1)
        : 0;
    console.log(chalk.blue(`Success Rate: ${successRate}%`));

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

  private renderNode(
    node: VisualizationNode,
    prefix: string,
    isLast: boolean
  ): void {
    const connector = isLast
      ? ProgressVisualizer.TREE_CHARS.corner
      : ProgressVisualizer.TREE_CHARS.junction;

    const statusColor =
      ProgressVisualizer.STATUS_COLORS[
        node.status as keyof typeof ProgressVisualizer.STATUS_COLORS
      ] || chalk.white;

    console.log(
      `${prefix}${connector}${ProgressVisualizer.TREE_CHARS.horizontal}` +
        statusColor(
          `[${node.status}] ${this.truncateText(
            node.systemPrompt,
            ProgressVisualizer.PROMPT_DISPLAY_LENGTH
          )}`
        )
    );

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

    const childPrefix =
      prefix +
      (isLast ? "    " : ProgressVisualizer.TREE_CHARS.vertical + "   ");
    node.children.forEach((child, index) => {
      this.renderNode(child, childPrefix, index === node.children.length - 1);
    });
  }

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

    const completionRate = (
      (summary.completedPaths / summary.totalPaths) *
      100
    ).toFixed(1);
    console.log(chalk.cyan(`Completion Rate: ${completionRate}%`));

    console.log(chalk.dim("======================\n"));
  }

  private getEventColor(event: string): (text: string) => string {
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

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength
      ? `${text.substring(0, maxLength - 3)}...`
      : text;
  }
}
