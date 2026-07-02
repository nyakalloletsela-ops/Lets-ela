/**
 * Unified LLM Client for Google Gemini API
 * Provides chat generation, structured JSON output, retries, and error handling
 */

import {
  GoogleGenerativeAI,
  GenerateContentRequest,
  Content,
} from "@google/generative-ai";

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StructuredOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * GeminiClient - Unified wrapper for Google Gemini API
 * Handles retries, structured JSON parsing, and error management
 */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: GeminiClientConfig) {
    if (!config.apiKey) {
      throw new Error("GEMINI_API_KEY is required");
    }

    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || "gemini-1.5-pro";
    this.maxRetries = config.maxRetries || 3;
    this.retryDelayMs = config.retryDelayMs || 1000;
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate chat response with automatic retries
   */
  async generateChat(
    messages: ChatMessage[],
    retryCount = 0
  ): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      // Convert messages to Gemini format
      const contents: Content[] = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // Get the last message as the new prompt
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== "user") {
        throw new Error("Last message must be from user");
      }

      const response = await model.generateContent(lastMessage.content);
      const text = response.response.text();

      return text;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(
          `[GeminiClient] Retry ${retryCount + 1}/${this.maxRetries} after ${this.retryDelayMs}ms`
        );
        await this.sleep(this.retryDelayMs);
        return this.generateChat(messages, retryCount + 1);
      }

      const errorMsg =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate chat after ${this.maxRetries} retries: ${errorMsg}`);
    }
  }

  /**
   * Generate structured JSON output
   * Requests JSON format from Gemini and validates output
   */
  async generateStructuredJSON<T = unknown>(
    prompt: string,
    schema?: unknown,
    retryCount = 0
  ): Promise<StructuredOutput<T>> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      // Enhance prompt to request JSON
      const enhancedPrompt = `${prompt}

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanations.
${schema ? `Expected format: ${JSON.stringify(schema, null, 2)}` : ""}`;

      const response = await model.generateContent(enhancedPrompt);
      const text = response.response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const jsonText = jsonMatch[0];
      const data = JSON.parse(jsonText) as T;

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(
          `[GeminiClient] JSON Retry ${retryCount + 1}/${this.maxRetries} after ${this.retryDelayMs}ms`
        );
        await this.sleep(this.retryDelayMs);
        return this.generateStructuredJSON<T>(prompt, schema, retryCount + 1);
      }

      const errorMsg =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to generate structured JSON after ${this.maxRetries} retries: ${errorMsg}`,
      };
    }
  }

  /**
   * Generate streaming response (returns text as it becomes available)
   * Note: For simplicity, we buffer the entire response
   */
  async generateStream(prompt: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const response = await model.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate stream: ${errorMsg}`);
    }
  }

  /**
   * Count tokens in a prompt (useful for cost estimation)
   */
  async countTokens(prompt: string): Promise<number> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const result = await model.countTokens(prompt);
      return result.totalTokens;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to count tokens: ${errorMsg}`);
    }
  }

  /**
   * Validate that the API key works
   */
  async validateConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });
      await model.generateContent("test");
      return true;
    } catch (error) {
      console.error(
        "[GeminiClient] Connection validation failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}

// Export factory function for easy instantiation
export function createGeminiClient(
  apiKey: string,
  config?: Omit<GeminiClientConfig, "apiKey">
): GeminiClient {
  return new GeminiClient({ apiKey, ...config });
}
