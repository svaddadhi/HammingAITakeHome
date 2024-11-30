jest.mock("../utils/logger.js");

import { jest } from "@jest/globals";
import { ProgressVisualizer } from "../visualization/progressVisualizer.js";
import { ConversationTree } from "../discovery/conversationTree.js";

describe("ProgressVisualizer", () => {
  let visualizer: ProgressVisualizer;
  let tree: ConversationTree;

  beforeEach(() => {
    visualizer = new ProgressVisualizer();
    tree = new ConversationTree();

    const rootNode = tree.initializeRoot("Initial prompt", "call_1");
    tree.updateNodeWithResponse(rootNode.id, "Agent response", ["Prompt 1"]);

    const childNode = tree.addNode(rootNode.id, "Prompt 1", "call_2");
    tree.updateNodeWithResponse(childNode.id, "Agent response 2", ["Prompt 2"]);
  });

  test("should visualize the conversation tree without errors", () => {
    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
    const consoleClearSpy = jest
      .spyOn(console, "clear")
      .mockImplementation(() => {});

    visualizer.visualizeTree(tree);

    expect(consoleClearSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleClearSpy.mockRestore();
  });

  test("should visualize progress without errors", () => {
    const state = {
      activeCallCount: 1,
      completedCallCount: 2,
      failedCallCount: 0,
      lastUpdateTimestamp: new Date(),
    };

    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    visualizer.visualizeProgress(state);

    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });

  test("should log conversation event without errors", () => {
    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});

    visualizer.logConversationEvent("node_1", "Conversation Completed", {
      responsePreview: "Sample response",
      newPathsIdentified: 1,
    });

    expect(consoleLogSpy).toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
