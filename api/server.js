import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const MAX_MESSAGE_LENGTH = 2048;
const MAX_UI_BYTES = 20 * 1024;
const RESOURCE_URI = "ui://hello_app_panel";
const HEALTH_PATH = "/health";
const DEBUG_MODE = process.env.MCP_DEBUG_MODE === "true";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-MCP-Debug",
  "Access-Control-Max-Age": "86400",
};

const helloWorldInputSchema = z.object({
  style: z.enum(["plain", "friendly"]).default("plain"),
});
const pingInputSchema = z.object({}).optional();

const handler = createMcpHandler(
  (server) => {
    const buildError = (code, message) => {
      const safeMessage = message.slice(0, MAX_MESSAGE_LENGTH);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: { code, message: safeMessage } }),
          },
        ],
        isError: true,
      };
    };

    const buildMessageResult = (message) => {
      const safeMessage = message.slice(0, MAX_MESSAGE_LENGTH);
      return {
        content: [
          {
            type: "text",
            text: safeMessage,
          },
        ],
      };
    };

    const helloAppHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hello MCP</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Inter", system-ui, -apple-system, sans-serif;
      }
      body {
        margin: 0;
        padding: 16px;
        background: transparent;
      }
      .panel {
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 12px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.85);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      }
      h1 {
        font-size: 18px;
        margin: 0 0 12px;
      }
      button {
        border: none;
        border-radius: 8px;
        padding: 10px 14px;
        background: #0f62fe;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      #result {
        margin-top: 12px;
        padding: 10px;
        border-radius: 8px;
        background: rgba(15, 98, 254, 0.08);
        min-height: 24px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div class="panel">
      <h1>Hello MCP</h1>
      <button id="hello-btn" type="button">Say hello</button>
      <div id="result" aria-live="polite"></div>
    </div>
    <script>
      const button = document.getElementById("hello-btn");
      const resultEl = document.getElementById("result");
      const pending = new Map();
      let nextId = 1;

      const parseMessage = (content) => {
        if (!Array.isArray(content)) return "";
        const textItem = content.find((item) => item && item.type === "text");
        if (!textItem) return "";
        const rawText = textItem.text || "";
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed.message === "string") {
            return parsed.message;
          }
          if (parsed && parsed.error && typeof parsed.error.message === "string") {
            return "Error: " + parsed.error.message;
          }
        } catch (error) {
          return rawText;
        }
        return rawText;
      };

      const setResult = (text) => {
        resultEl.textContent = text || "";
      };

      const handleToolResult = (result) => {
        const message = parseMessage(result?.content);
        setResult(message);
      };

      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || data.jsonrpc !== "2.0") return;
        if (data.id && pending.has(data.id)) {
          const resolver = pending.get(data.id);
          pending.delete(data.id);
          resolver(data.result || data);
          return;
        }
        if (data.method && data.params) {
          const candidate = data.params.result || data.params.toolResult || data.params;
          if (candidate && candidate.content) {
            handleToolResult(candidate);
          }
        }
      });

      const callHelloWorld = () => {
        const id = nextId++;
        const request = {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: {
            name: "hello_world",
            arguments: { style: "friendly" },
          },
        };
        return new Promise((resolve) => {
          pending.set(id, resolve);
          window.parent?.postMessage(request, "*");
        });
      };

      button.addEventListener("click", async () => {
        button.disabled = true;
        setResult("Sending hello...");
        try {
          const result = await callHelloWorld();
          handleToolResult(result);
        } catch (error) {
          setResult("Error: Unable to reach the MCP host.");
        } finally {
          button.disabled = false;
        }
      });
    </script>
  </body>
</html>`;

    const buildUiResponse = () => {
      if (Buffer.byteLength(helloAppHtml, "utf8") > MAX_UI_BYTES) {
        return {
          contents: [
            {
              uri: RESOURCE_URI,
              mimeType: "text/plain",
              text: JSON.stringify({
                error: {
                  code: "INTERNAL_ERROR",
                  message: "UI payload exceeds size limit.",
                },
              }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: "text/html",
            text: helloAppHtml,
          },
        ],
      };
    };

    server.resource(
      "hello_app_panel",
      RESOURCE_URI,
      {
        mimeType: "text/html",
        description: "Inline Hello MCP panel.",
      },
      async () => {
        try {
          return buildUiResponse();
        } catch (error) {
          return {
            contents: [
              {
                uri: RESOURCE_URI,
                mimeType: "text/plain",
                text: JSON.stringify({
                  error: {
                    code: "INTERNAL_ERROR",
                    message: "Failed to render UI resource.",
                  },
                }),
              },
            ],
          };
        }
      },
    );

    server.server.registerCapabilities({
      tools: {
        listChanged: true,
      },
    });

    const listToolsRequestSchema = z
      .object({
        method: z.literal("tools/list"),
      })
      .passthrough();

    const callToolRequestSchema = z
      .object({
        method: z.literal("tools/call"),
        params: z.unknown().optional(),
      })
      .passthrough();

    server.server.setRequestHandler(listToolsRequestSchema, () => ({
      tools: [
        {
          name: "hello_world",
          description: "Return a hello message.",
          inputSchema: {
            type: "object",
            properties: {
              style: {
                type: "string",
                enum: ["plain", "friendly"],
                default: "plain",
              },
            },
            additionalProperties: false,
          },
          _meta: {
            ui: {
              resourceUri: RESOURCE_URI,
            },
          },
        },
        {
          name: "ping",
          description: "Health probe tool that replies with pong.",
          inputSchema: {
            type: "object",
            additionalProperties: false,
          },
        },
      ],
    }));

    server.server.setRequestHandler(callToolRequestSchema, async (request) => {
      const params =
        request && typeof request.params === "object"
          ? request.params
          : undefined;
      const name = params && typeof params.name === "string" ? params.name : "";
      const args =
        params && typeof params.arguments === "object" && params.arguments
          ? params.arguments
          : {};
      if (!name) {
        return buildError("BAD_REQUEST", "Missing tool name.");
      }
      if (DEBUG_MODE || args?.debug === true) {
        return buildError(
          "DEBUG_MODE",
          "Debug mode forced an error for this tool call.",
        );
      }
      if (name === "ping") {
        const parsed = pingInputSchema.safeParse(args ?? {});
        if (!parsed.success) {
          console.error("Ping parser error:", parsed.error.format());
          return buildError(
            "BAD_REQUEST",
            `Invalid arguments for ping. ${parsed.error.message}`,
          );
        }
        return buildMessageResult("pong");
      }
      if (name !== "hello_world") {
        return buildError("BAD_REQUEST", "Unknown tool requested.");
      }

      try {
        const parsed = helloWorldInputSchema.safeParse(args);
        if (!parsed.success) {
          console.error("hello_world parser error:", parsed.error.format());
          return buildError(
            "BAD_REQUEST",
            `Invalid arguments for hello_world. ${parsed.error.message}`,
          );
        }

        const style = parsed.data.style;
        const message =
          style === "friendly" ? "Hello from MCP! 👋" : "Hello from MCP.";
        return buildMessageResult(message);
      } catch (error) {
        console.error("Unexpected hello_world error:", error);
        return buildError("INTERNAL_ERROR", "Unexpected error in hello_world.");
      }
    });
  },
  {},
  {
    verboseLogs: true,
    onEvent: (event) => {
      if (event.type === "REQUEST_RECEIVED") {
        console.log("MCP JSON-RPC request:", {
          method: event.method,
          parameters: event.parameters,
        });
      }
      if (event.type === "REQUEST_COMPLETED") {
        console.log("MCP JSON-RPC response:", {
          method: event.method,
          result: event.result,
          status: event.status,
          duration: event.duration,
        });
      }
      if (event.type === "ERROR") {
        console.error("MCP server error:", event);
      }
    },
  },
);

const withCors = (response) => {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const buildHealthResponse = () =>
  new Response(
    JSON.stringify({
      status: "ok",
      debugMode: DEBUG_MODE,
      time: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

const shouldForceDebugError = (requestUrl, request) => {
  if (DEBUG_MODE) return true;
  if (request.headers.get("x-mcp-debug") === "1") return true;
  return requestUrl.searchParams.get("debug") === "1";
};

const handleRequest = async (request) => {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (url.pathname === HEALTH_PATH || url.pathname.endsWith(HEALTH_PATH)) {
    return withCors(buildHealthResponse());
  }

  if (shouldForceDebugError(url, request)) {
    return withCors(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Debug mode forced an error for inspection.",
          },
          id: null,
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  }

  if (
    request.method === "POST" &&
    request.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      await request.clone().json();
    } catch (error) {
      console.error("JSON parse error for incoming request:", error);
      return withCors(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Parse error: invalid JSON request body.",
              details: error instanceof Error ? error.message : String(error),
            },
            id: null,
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    }
  }

  const response = await handler(request);
  return withCors(response);
};

export { handleRequest as GET, handleRequest as POST, handleRequest as DELETE, handleRequest as OPTIONS };
