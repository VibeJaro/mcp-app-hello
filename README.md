# Run an MCP Server on Vercel

## Usage

Update `api/server.js` with your tools, prompts, and resources following the [MCP TypeScript SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk/tree/main?tab=readme-ov-file#server).

[There is also a Next.js version of this template](https://vercel.com/templates/next.js/model-context-protocol-mcp-with-next-js)

## MCP Client Integration

When adding this server to an MCP client application, use your deployment URL followed by `/mcp` (Streamable HTTP). The SSE transport is available at `/sse`:

```
https://your-deployment-url.vercel.app/mcp
```

## MCP Apps UI hook

This template registers an MCP Apps UI resource at `ui://hello_app_panel` and links it to the `hello_world` tool via `_meta.ui.resourceUri`. MCP hosts that support MCP Apps will render the panel inline and forward tool calls initiated from the UI.

## Example Tools

The template includes one example tool to get you started:

- **`hello_world`** - Returns a hello message with an allowlisted `style` input.

## Notes for running on Vercel

- Make sure you have [Fluid compute](https://vercel.com/docs/functions/fluid-compute) enabled for efficient execution
- After enabling Fluid compute, open `vercel.json` and adjust max duration to 800 if you using a Vercel Pro or Enterprise account
- [Deploy the MCP template](https://vercel.com/templates/other/model-context-protocol-mcp-with-vercel-functions)

## Local dev

- Run `vercel dev` for local development
- Alternatively, integrate the system into the server framework of your choice.

## Testing & validation

You can list tools via the included clients:

```sh
node scripts/test-streamable-http-client.mjs http://localhost:3000
```

Or for SSE transport:

```sh
node scripts/test-client.mjs http://localhost:3000
```

To manually call the tool via Streamable HTTP, use a simple JSON-RPC request (replace the origin as needed):

```sh
curl -sS http://localhost:3000/mcp \\
  -H 'content-type: application/json' \\
  -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"hello_world\",\"arguments\":{\"style\":\"friendly\"}}}'
```

## Sample Client

`scripts/test-client.mjs` contains a sample client to try invocations.

```sh
node scripts/test-client.mjs https://mcp-on-vercel.vercel.app
```
