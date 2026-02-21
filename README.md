# solafon-mcp

Model Context Protocol server for building bots and interacting with Solana wallet on the [Solafon](https://solafon.com) platform.

Connect this MCP server to **Claude Desktop**, **Cursor**, **VS Code**, or any MCP-compatible AI tool to build Solafon mini-apps using natural language.

## Quick Start

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "solafon": {
      "command": "npx",
      "args": ["-y", "solafon-mcp"],
      "env": {
        "SOLAFON_BOT_TOKEN": "your-bot-api-key-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "solafon": {
      "command": "npx",
      "args": ["-y", "solafon-mcp"],
      "env": {
        "SOLAFON_BOT_TOKEN": "your-bot-api-key-here"
      }
    }
  }
}
```

### VS Code

Add to your VS Code MCP settings:

```json
{
  "mcp": {
    "servers": {
      "solafon": {
        "command": "npx",
        "args": ["-y", "solafon-mcp"],
        "env": {
          "SOLAFON_BOT_TOKEN": "your-bot-api-key-here"
        }
      }
    }
  }
}
```

## Requirements

- **Node.js 18+** (no other dependencies needed)

## Available Tools

### Bot API

| Tool | Description |
|------|-------------|
| `get_bot_info` | Get your bot's app info |
| `send_message` | Send text, images, buttons, carousels |
| `edit_message` | Edit a previously sent message |
| `delete_message` | Delete a message |
| `list_conversations` | List all bot conversations |
| `get_conversation_messages` | Read messages in a conversation |
| `get_user` | Get user info |
| `set_webhook` | Configure webhook URL |
| `set_welcome_message` | Set greeting for new users |

### Wallet API

| Tool | Description |
|------|-------------|
| `get_wallet_balance` | SOL + token balances with USD values |
| `get_token_list` | Supported tokens with metadata |
| `get_token_prices` | Current USD prices |
| `get_transaction_history` | Wallet transaction history |
| `get_transaction_status` | Check transaction confirmation |
| `get_latest_blockhash` | Get blockhash for transactions |
| `send_transaction` | Broadcast signed transaction |
| `simulate_transaction` | Simulate before sending |

## Prompts (Templates)

| Prompt | Description |
|--------|-------------|
| `create_echo_bot` | Step-by-step echo bot guide |
| `create_wallet_checker_bot` | Bot that checks wallet balances |
| `create_interactive_menu_bot` | Bot with button menus and callbacks |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SOLAFON_BOT_TOKEN` | Yes | — | Bot API token from developer portal |
| `SOLAFON_API_URL` | No | `https://api.solafon.com` | API base URL |

## Getting a Bot Token

1. Register at [Solafon](https://solafon.com)
2. Go to Developer Portal
3. Create a new app
4. Copy the API key shown after creation

## Example Usage with Claude

After connecting the MCP server, you can say to Claude:

> "Check the SOL balance of wallet address 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"

> "Send a welcome message to conversation abc-123 with two buttons: Check Balance and Help"

> "Set up my bot's webhook to https://myserver.com/webhook"

> "Show me the last 10 transactions for this wallet"

## Documentation

Full documentation: [docs.solafon.com](https://docs.solafon.com)

## License

MIT
