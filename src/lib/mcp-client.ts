/**
 * MCP Client for communicating with the MCP server via stdio
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

interface MCPToolResult {
  content: Array<{ type: string; text: string }>;
}

/**
 * MCP Client Class - Manages connection to MCP server
 */
class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  /**
   * Connect to the MCP server
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      // Path to MCP server
      const mcpServerPath = path.join(process.cwd(), "mcp-server", "dist", "index.js");

      // Create transport with command and args
      // The SDK will handle spawning the process
      // Filter out undefined values from process.env
      const env = Object.entries(process.env).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      this.transport = new StdioClientTransport({
        command: "node",
        args: [mcpServerPath],
        env,
      });

      // Create client
      this.client = new Client(
        {
          name: "qwiknotes-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // Connect
      await this.client.connect(this.transport);
      this.isConnected = true;

      console.log("✅ MCP Client connected");
    } catch (error) {
      console.error("❌ Failed to connect to MCP server:", error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    if (this.client && this.transport) {
      await this.client.close();
      this.client = null;
      this.transport = null;
      this.isConnected = false;
      console.log("MCP Client disconnected");
    }
  }

  /**
   * List available tools from MCP server
   */
  async listTools() {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    const response = await this.client.listTools();
    return response.tools;
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.client) {
      throw new Error("MCP client not connected");
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });

      return response as MCPToolResult;
    } catch (error) {
      console.error(`MCP tool call failed for ${name}:`, error);
      throw error;
    }
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create MCP client instance
 */
export async function getMCPClient(): Promise<MCPClient> {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
    await mcpClientInstance.connect();
  }
  return mcpClientInstance;
}

/**
 * Call MCP tool (convenience wrapper)
 */
export async function callMCPToolViaStdio(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const client = await getMCPClient();
  const result = await client.callTool(name, args);

  // Parse the result
  if (result.content && result.content[0]) {
    try {
      return JSON.parse(result.content[0].text) as Record<string, unknown>;
    } catch {
      return { result: result.content[0].text };
    }
  }

  return result as unknown as Record<string, unknown>;
}

/**
 * Clean up MCP client on process exit
 */
process.on("beforeExit", async () => {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
  }
});
