// src/utils/openai.ts

import OpenAI from "openai";
import logger from "./logger.js";

// Initialize OpenAI client with environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates contextual responses for a given prompt using GPT-3.5-turbo
 * Enhanced with better error handling and response validation
 */
export async function generateResponses(
  prompt: string,
  options: {
    temperature?: number;
    maxResponses?: number;
    businessContext?: string;
  } = {}
): Promise<string[]> {
  const { temperature = 0.7, maxResponses = 4 } = options;

  try {
    // Create a more structured prompt for better response generation
    const enhancedPrompt = `As an AI testing voice response systems, analyze this interaction:

"${prompt}"

Generate ${maxResponses} different, natural customer responses for this situation.
Focus on responses that would:
1. Move the conversation forward
2. Be common in real customer service calls
3. Encourage the agent to provide more information or services

Format: Return ONLY the responses, one per line. Each response should be a complete statement.
Example format:
I need help with my AC, it's not cooling properly
I'd like to schedule a maintenance appointment
What services do you offer for plumbing issues?

Your responses:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an AI helping test customer service voice systems. Generate realistic customer responses that help explore all possible conversation paths. Keep responses natural and focused on common customer inquiries.",
        },
        { role: "user", content: enhancedPrompt },
      ],
      temperature: temperature,
      max_tokens: 300,
      presence_penalty: 0.6, // Encourage diverse responses
      frequency_penalty: 0.4, // Reduce repetition
    });

    // Process and clean up the responses
    const responses =
      completion.choices[0].message.content
        ?.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("-"))
        .slice(0, maxResponses) ?? [];

    // Validate that we got meaningful responses
    if (responses.length === 0) {
      logger.warn("No responses generated from OpenAI", {
        prompt: prompt.substring(0, 100),
        rawResponse: completion.choices[0].message.content,
      });
      // Provide fallback responses for initial greeting
      if (prompt.toLowerCase().includes("thank you for calling")) {
        return [
          "I need help with a service issue",
          "I'd like to learn about your services",
          "I'm interested in scheduling an appointment",
          "Can you tell me about your rates?",
        ];
      }
    }

    logger.info("Successfully generated AI responses", {
      promptLength: prompt.length,
      responseCount: responses.length,
      firstResponse: responses[0]?.substring(0, 30),
    });

    return responses;
  } catch (error) {
    logger.error("Error generating AI responses", {
      error: error instanceof Error ? error.message : "Unknown error",
      promptPreview: prompt.substring(0, 100),
    });

    // Return fallback responses rather than empty array
    return [
      "I need some help with a service",
      "Could you tell me about your services?",
      "I'm interested in getting more information",
    ];
  }
}
