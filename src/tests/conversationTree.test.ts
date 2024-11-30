jest.mock("../utils/logger.js");

import { describe, test, expect, beforeEach } from "@jest/globals";
import { ConversationTree } from "../discovery/conversationTree.js";

describe("ConversationTree", () => {
  let tree: ConversationTree;

  beforeEach(() => {
    tree = new ConversationTree();
  });

  test("should initialize root node correctly", () => {
    const systemPrompt = "Initial prompt";
    const callId = "call_123";

    const rootNode = tree.initializeRoot(systemPrompt, callId);

    expect(rootNode).toBeDefined();
    expect(rootNode.id).toBe("root");
    expect(rootNode.systemPrompt).toBe(systemPrompt);
    expect(rootNode.callId).toBe(callId);
    expect(rootNode.depth).toBe(0);
    expect(rootNode.parentId).toBeNull();
  });

  test("should add a child node correctly", () => {
    const systemPrompt = "Initial prompt";
    const callId = "call_123";
    tree.initializeRoot(systemPrompt, callId);

    const childPrompt = "Child prompt";
    const childCallId = "call_456";
    const childNode = tree.addNode("root", childPrompt, childCallId);

    expect(childNode).toBeDefined();
    expect(childNode.parentId).toBe("root");
    expect(childNode.systemPrompt).toBe(childPrompt);
    expect(childNode.callId).toBe(childCallId);
    expect(childNode.depth).toBe(1);

    const rootNode = tree.getAllNodes().find((node) => node.id === "root");
    expect(rootNode?.children).toHaveLength(1);
    expect(rootNode?.children[0].id).toBe(childNode.id);
  });

  test("should not allow adding node beyond max depth", () => {
    const treeWithMaxDepth = new ConversationTree(2);
    const systemPrompt = "Initial prompt";
    const callId = "call_123";
    treeWithMaxDepth.initializeRoot(systemPrompt, callId);

    const childPrompt1 = "Unique child prompt one";
    const childCallId1 = "call_456";
    const childNode1 = treeWithMaxDepth.addNode(
      "root",
      childPrompt1,
      childCallId1
    );

    const childPrompt2 = "Unique child prompt two";
    const childCallId2 = "call_789";
    const childNode2 = treeWithMaxDepth.addNode(
      childNode1.id,
      childPrompt2,
      childCallId2
    );

    const childPrompt3 = "Unique child prompt three";
    const childCallId3 = "call_012";

    expect(() => {
      treeWithMaxDepth.addNode(childNode2.id, childPrompt3, childCallId3);
    }).toThrowError(`Maximum depth ${treeWithMaxDepth["maxDepth"]} reached`);
  });

  test("should update node with response and potential prompts", () => {
    const systemPrompt = "Initial prompt";
    const callId = "call_123";
    const rootNode = tree.initializeRoot(systemPrompt, callId);

    const response = "Agent response";
    const potentialPrompts = ["Prompt 1", "Prompt 2"];

    const newThemes = tree.updateNodeWithResponse(
      rootNode.id,
      response,
      potentialPrompts
    );

    const updatedNode = tree
      .getAllNodes()
      .find((node) => node.id === rootNode.id);

    expect(updatedNode?.responseReceived).toBe(response);
    expect(updatedNode?.potentialPrompts).toEqual(potentialPrompts);
    expect(updatedNode?.status).toBe("completed");
    expect(newThemes.size).toBeGreaterThanOrEqual(0);
  });

  test("should get nodes with unexplored paths", () => {
    const systemPrompt = "Initial prompt";
    const callId = "call_123";
    const rootNode = tree.initializeRoot(systemPrompt, callId);

    const response = "Agent response about emergency";
    const potentialPrompts = ["Prompt 1", "Prompt 2"];

    tree.updateNodeWithResponse(rootNode.id, response, potentialPrompts);

    const nodesWithUnexploredPaths = tree.getNodesWithUnexploredPaths();

    expect(nodesWithUnexploredPaths).toHaveLength(1);
    expect(nodesWithUnexploredPaths[0].id).toBe(rootNode.id);
  });
});
