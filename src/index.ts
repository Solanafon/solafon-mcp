#!/usr/bin/env node

/**
 * Solafon MCP Server
 *
 * Model Context Protocol server that exposes Solafon Bot API and Wallet API
 * as tools for AI assistants (Claude Desktop, Cursor, VS Code, etc.)
 *
 * Usage:
 *   npx solafon-mcp
 *
 * Environment variables:
 *   SOLAFON_API_URL     — API base URL (default: https://api.solafon.com)
 *   SOLAFON_BOT_TOKEN   — Bot API token (X-Bot-Token)
 *   SOLAFON_APP_ID      — App ID (auto-detected from bot token if not set)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.SOLAFON_API_URL || "https://api.solafon.com";
const BOT_TOKEN = process.env.SOLAFON_BOT_TOKEN || "";

// ─── HTTP Helper ───────────────────────────────────────────────────────────────

async function apiCall(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (BOT_TOKEN) {
    headers["X-Bot-Token"] = BOT_TOKEN;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: res.status, body: text };
  }
}

function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

// ─── Server Setup ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "solafon",
  version: "1.0.0",
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOT API TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "get_bot_info",
  "Get information about the current bot app (name, description, status, webhook URL)",
  {},
  async () => {
    const result = await apiCall("GET", "/api/bot/me");
    return ok(result);
  }
);

server.tool(
  "send_message",
  "Send a message from the bot to a user in a specific conversation. Supports text, buttons, images, and card carousels.",
  {
    conversationId: z
      .string()
      .uuid()
      .describe("The conversation ID to send the message to"),
    type: z
      .enum(["text", "image", "carousel"])
      .default("text")
      .describe("Message content type"),
    text: z
      .string()
      .optional()
      .describe("Text content of the message (required for type=text)"),
    imageUrl: z
      .string()
      .url()
      .optional()
      .describe("Image URL (for type=image)"),
    buttons: z
      .array(
        z.object({
          id: z.string().describe("Unique button ID"),
          text: z.string().describe("Button label"),
          action: z
            .enum(["callback", "url", "webApp"])
            .describe("Button action type"),
          payload: z
            .string()
            .optional()
            .describe("Callback payload (for action=callback)"),
          url: z
            .string()
            .optional()
            .describe("URL to open (for action=url or webApp)"),
        })
      )
      .optional()
      .describe("Interactive buttons attached to the message"),
    cards: z
      .array(
        z.object({
          id: z.string().describe("Unique card ID"),
          title: z.string().describe("Card title"),
          subtitle: z.string().optional().describe("Card subtitle"),
          imageUrl: z.string().optional().describe("Card image URL"),
          buttons: z
            .array(
              z.object({
                id: z.string(),
                text: z.string(),
                action: z.enum(["callback", "url", "webApp"]),
                payload: z.string().optional(),
                url: z.string().optional(),
              })
            )
            .optional()
            .describe("Card buttons"),
        })
      )
      .optional()
      .describe("Cards for carousel messages"),
  },
  async (args) => {
    const content: Record<string, unknown> = { type: args.type };
    if (args.text) content.text = args.text;
    if (args.imageUrl) content.imageUrl = args.imageUrl;
    if (args.buttons) content.buttons = args.buttons;
    if (args.cards) content.cards = args.cards;

    const result = await apiCall("POST", "/api/bot/messages", {
      conversationId: args.conversationId,
      content,
    });
    return ok(result);
  }
);

server.tool(
  "edit_message",
  "Edit a previously sent bot message",
  {
    messageId: z.string().uuid().describe("ID of the message to edit"),
    type: z.enum(["text", "image", "carousel"]).default("text"),
    text: z.string().optional().describe("New text content"),
    buttons: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          action: z.enum(["callback", "url", "webApp"]),
          payload: z.string().optional(),
          url: z.string().optional(),
        })
      )
      .optional(),
  },
  async (args) => {
    const content: Record<string, unknown> = { type: args.type };
    if (args.text) content.text = args.text;
    if (args.buttons) content.buttons = args.buttons;

    const result = await apiCall("PATCH", `/api/bot/messages/${args.messageId}`, {
      content,
    });
    return ok(result);
  }
);

server.tool(
  "delete_message",
  "Delete a bot message by ID",
  {
    messageId: z.string().uuid().describe("ID of the message to delete"),
  },
  async (args) => {
    const result = await apiCall("DELETE", `/api/bot/messages/${args.messageId}`);
    return ok(result);
  }
);

server.tool(
  "list_conversations",
  "List all conversations for the bot app with pagination",
  {
    limit: z.number().int().min(1).max(100).default(20).describe("Number of conversations to return"),
    offset: z.number().int().min(0).default(0).describe("Offset for pagination"),
  },
  async (args) => {
    const result = await apiCall("GET", "/api/bot/conversations", undefined, {
      limit: args.limit.toString(),
      offset: args.offset.toString(),
    });
    return ok(result);
  }
);

server.tool(
  "get_conversation_messages",
  "Get messages in a specific conversation",
  {
    conversationId: z.string().uuid().describe("Conversation ID"),
    limit: z.number().int().min(1).max(100).default(50).describe("Number of messages"),
    before: z.string().uuid().optional().describe("Cursor: message ID to paginate before"),
  },
  async (args) => {
    const query: Record<string, string> = { limit: args.limit.toString() };
    if (args.before) query.before = args.before;

    const result = await apiCall(
      "GET",
      `/api/bot/conversations/${args.conversationId}/messages`,
      undefined,
      query
    );
    return ok(result);
  }
);

server.tool(
  "get_user",
  "Get information about a user who has a conversation with this bot",
  {
    userId: z.string().uuid().describe("User ID"),
  },
  async (args) => {
    const result = await apiCall("GET", `/api/bot/users/${args.userId}`);
    return ok(result);
  }
);

server.tool(
  "set_webhook",
  "Configure the webhook URL where the bot receives events (messages, callbacks)",
  {
    url: z.string().url().describe("Webhook URL (must be HTTPS)"),
    events: z
      .array(z.string())
      .optional()
      .describe("Event types to subscribe to (default: all)"),
  },
  async (args) => {
    // Need to get app ID from bot info first
    const botInfo = (await apiCall("GET", "/api/bot/me")) as Record<string, unknown>;
    const appId = (botInfo as { id?: string }).id;
    if (!appId) return ok({ error: "Could not determine app ID. Check your bot token." });

    const result = await apiCall("PUT", `/api/developer/apps/${appId}/webhook`, {
      url: args.url,
      events: args.events,
    });
    return ok(result);
  }
);

server.tool(
  "set_welcome_message",
  "Set the welcome message shown when a user starts a conversation",
  {
    text: z.string().describe("Welcome message text"),
    buttons: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          action: z.enum(["callback", "url", "webApp"]),
          payload: z.string().optional(),
          url: z.string().optional(),
        })
      )
      .optional()
      .describe("Optional buttons on the welcome message"),
  },
  async (args) => {
    const botInfo = (await apiCall("GET", "/api/bot/me")) as Record<string, unknown>;
    const appId = (botInfo as { id?: string }).id;
    if (!appId) return ok({ error: "Could not determine app ID." });

    const content: Record<string, unknown> = { type: "text", text: args.text };
    if (args.buttons) content.buttons = args.buttons;

    const result = await apiCall(
      "PUT",
      `/api/developer/apps/${appId}/welcome-message`,
      { content }
    );
    return ok(result);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET API TOOLS
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  "get_wallet_balance",
  "Get SOL and SPL token balances for a Solana wallet address, including USD values",
  {
    address: z.string().describe("Solana wallet address (base58)"),
  },
  async (args) => {
    const result = await apiCall("GET", "/api/wallet/balance", undefined, {
      address: args.address,
    });
    return ok(result);
  }
);

server.tool(
  "get_token_list",
  "Get the list of supported SPL tokens with mint addresses, symbols, and metadata",
  {},
  async () => {
    const result = await apiCall("GET", "/api/wallet/tokens");
    return ok(result);
  }
);

server.tool(
  "get_token_prices",
  "Get current USD prices for Solana tokens",
  {
    mints: z
      .string()
      .optional()
      .describe("Comma-separated mint addresses, or 'all' for all supported tokens"),
  },
  async (args) => {
    const result = await apiCall("GET", "/api/wallet/prices", undefined, {
      mints: args.mints || "all",
    });
    return ok(result);
  }
);

server.tool(
  "get_transaction_history",
  "Get transaction history for a Solana wallet address",
  {
    address: z.string().describe("Solana wallet address"),
    limit: z.number().int().min(1).max(50).default(20).describe("Number of transactions"),
    before: z.string().optional().describe("Transaction signature cursor for pagination"),
  },
  async (args) => {
    const query: Record<string, string> = {
      address: args.address,
      limit: args.limit.toString(),
    };
    if (args.before) query.before = args.before;

    const result = await apiCall("GET", "/api/wallet/transactions", undefined, query);
    return ok(result);
  }
);

server.tool(
  "get_transaction_status",
  "Check the confirmation status of a Solana transaction",
  {
    signature: z.string().describe("Transaction signature"),
  },
  async (args) => {
    const result = await apiCall("GET", "/api/wallet/status", undefined, {
      signature: args.signature,
    });
    return ok(result);
  }
);

server.tool(
  "get_latest_blockhash",
  "Get the latest blockhash needed for building Solana transactions",
  {},
  async () => {
    const result = await apiCall("GET", "/api/wallet/blockhash");
    return ok(result);
  }
);

server.tool(
  "send_transaction",
  "Send a pre-signed Solana transaction to the network",
  {
    signedTransaction: z
      .string()
      .describe("Base64-encoded signed transaction"),
  },
  async (args) => {
    const result = await apiCall("POST", "/api/wallet/send", {
      signedTransaction: args.signedTransaction,
    });
    return ok(result);
  }
);

server.tool(
  "simulate_transaction",
  "Simulate a Solana transaction to check for errors and estimate fees before sending",
  {
    transaction: z.string().describe("Base64-encoded transaction to simulate"),
  },
  async (args) => {
    const result = await apiCall("POST", "/api/wallet/simulate", {
      transaction: args.transaction,
    });
    return ok(result);
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPTS (Reusable templates for common tasks)
// ═══════════════════════════════════════════════════════════════════════════════

server.prompt(
  "create_echo_bot",
  "Step-by-step guide to create a simple echo bot on Solafon",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Create a Solafon echo bot that replies to every user message with the same text.

Steps:
1. Use get_bot_info to verify the bot token is working
2. Use set_webhook to set your webhook URL
3. Use set_welcome_message to greet new users
4. Here's the webhook handler code (Node.js/Express):

\`\`\`javascript
const express = require('express');
const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.SOLAFON_BOT_TOKEN;
const API_URL = 'https://api.solafon.com';

app.post('/webhook', async (req, res) => {
  const { event, message } = req.body;

  if (event === 'message' && message.content.type === 'text') {
    await fetch(\`\${API_URL}/api/bot/messages\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Token': BOT_TOKEN,
      },
      body: JSON.stringify({
        conversationId: message.conversationId,
        content: {
          type: 'text',
          text: \`Echo: \${message.content.text}\`,
        },
      }),
    });
  }

  res.json({ ok: true });
});

app.listen(3000);
\`\`\``,
        },
      },
    ],
  })
);

server.prompt(
  "create_wallet_checker_bot",
  "Create a bot that checks Solana wallet balances when users send an address",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Create a Solafon bot that checks Solana wallet balances.

When a user sends a Solana address, the bot should:
1. Call get_wallet_balance with the address
2. Format the response showing SOL balance and top tokens
3. Send the formatted response back

Use these tools:
- get_bot_info — verify connection
- set_webhook — configure webhook URL
- get_wallet_balance — check balances
- send_message — reply to users

The webhook handler should detect Solana addresses (base58, 32-44 chars) in user messages.`,
        },
      },
    ],
  })
);

server.prompt(
  "create_interactive_menu_bot",
  "Create a bot with interactive button menus and callbacks",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Create a Solafon bot with interactive menus using buttons and callbacks.

Features:
- Welcome message with action buttons
- Button callbacks that trigger different responses
- Card carousel for listing items

Use send_message with buttons:
\`\`\`json
{
  "conversationId": "...",
  "content": {
    "type": "text",
    "text": "What would you like to do?",
    "buttons": [
      {"id": "prices", "text": "Token Prices", "action": "callback", "payload": "show_prices"},
      {"id": "help", "text": "Help", "action": "callback", "payload": "show_help"},
      {"id": "web", "text": "Open dApp", "action": "url", "url": "https://app.solafon.com"}
    ]
  }
}
\`\`\`

Handle callbacks in webhook:
\`\`\`javascript
if (event === 'callback') {
  const { payload, conversationId } = req.body;
  switch (payload) {
    case 'show_prices': /* fetch and send prices */ break;
    case 'show_help': /* send help text */ break;
  }
}
\`\`\``,
        },
      },
    ],
  })
);

// ═══════════════════════════════════════════════════════════════════════════════
// RESOURCES (Documentation links)
// ═══════════════════════════════════════════════════════════════════════════════

server.resource("docs://bot-api", "docs://bot-api", async () => ({
  contents: [
    {
      uri: "docs://bot-api",
      mimeType: "text/markdown",
      text: `# Solafon Bot API Reference

Base URL: https://api.solafon.com
Auth: X-Bot-Token header

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/bot/me | Get bot info |
| POST | /api/bot/messages | Send message |
| PATCH | /api/bot/messages/:id | Edit message |
| DELETE | /api/bot/messages/:id | Delete message |
| GET | /api/bot/conversations | List conversations |
| GET | /api/bot/conversations/:id/messages | Get messages |
| GET | /api/bot/users/:id | Get user info |

## Message Types

- **text**: Simple text with optional buttons
- **image**: Image with optional caption
- **carousel**: Card carousel with images and buttons

## Button Actions

- **callback**: Triggers webhook callback event
- **url**: Opens URL in browser
- **webApp**: Opens URL in Solafon WebView

## Webhook Events

Your webhook URL receives POST requests:
- \`message\` — User sent a message
- \`callback\` — User clicked a button

## Rate Limits

1000 requests per minute per bot token.

Full docs: https://docs.solafon.com/en/docs/bot-api/overview
`,
    },
  ],
}));

server.resource("docs://wallet-api", "docs://wallet-api", async () => ({
  contents: [
    {
      uri: "docs://wallet-api",
      mimeType: "text/markdown",
      text: `# Solafon Wallet API Reference

Base URL: https://api.solafon.com
Auth: None required (public endpoints)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/wallet/balance?address=... | Get wallet balance |
| GET | /api/wallet/tokens | Supported token list |
| GET | /api/wallet/prices?mints=... | Token prices (USD) |
| GET | /api/wallet/transactions?address=... | Transaction history |
| GET | /api/wallet/status?signature=... | Transaction status |
| GET | /api/wallet/blockhash | Latest blockhash |
| POST | /api/wallet/send | Send signed transaction |
| POST | /api/wallet/simulate | Simulate transaction |

## Non-Custodial Architecture

Solafon wallet is non-custodial. Private keys never leave the client.
The API provides:
- Balance queries (RPC proxy)
- Token metadata and prices
- Transaction broadcasting
- Transaction simulation

Full docs: https://docs.solafon.com/en/docs/wallet-api/overview
`,
    },
  ],
}));

// ─── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Solafon MCP Server error:", err);
  process.exit(1);
});
