# agents.md

## Project: Vercel MCP Server + MCP-Apps Hello Panel (TypeScript)

### Goal
Implement a minimal MCP server on top of the existing Vercel MCP template that:
1) exposes a tool `hello_world`
2) exposes an MCP-Apps UI resource rendering an inline panel with a button that calls `hello_world` and displays the result.

### Non-goals
- No shell execution
- No filesystem access beyond what the template already requires
- No external HTTP requests (other than MCP protocol handling)
- No authentication work in this iteration

### Safety constraints
- Do not accept unbounded free-form strings as tool input.
- Use allowlisted inputs only (enum/boolean).
- Hard limit response sizes:
  - message string <= 2048 chars
  - UI payload <= 20 KB
- Never return stack traces or environment variables to the client.
- Never log secrets. Avoid logging request bodies; if logging, log only high-level events.

### Architecture rules
- Follow the Vercel MCP template’s file layout and conventions.
- Implement within the existing API route(s) (e.g., `/api/*`) as the template intends.
- Keep dependencies unchanged unless absolutely necessary.

### Tool definition
- Name: `hello_world`
- Input schema:
  - `style`: enum ["plain", "friendly"], default "plain"
- Output schema:
  - `{ "message": string }`

### MCP-Apps UI resource
- Resource id: `hello_app_panel`
- UI requirements:
  - Title: "Hello MCP"
  - Button: "Say hello"
  - Output area for the returned message
- Behavior:
  - Button click triggers `hello_world` with `style="friendly"`
  - Display the returned message in the UI output area

### Error handling
- Wrap all handlers in try/catch
- Return a structured error object (no stack trace):
  - `{ "error": { "code": "INTERNAL_ERROR" | "BAD_REQUEST", "message": string } }`
- Ensure any thrown errors are converted to the above format.

### Testing & docs
- Update README with:
  - Deployed endpoint URL shape
  - How to run locally (if template supports)
  - How to validate tool and UI resource exist
- Provide minimal manual test instructions (e.g., sample MCP client call) if feasible.

### Deliverables checklist
- [ ] Tool `hello_world` implemented and registered
- [ ] MCP-Apps UI resource `hello_app_panel` implemented and registered
- [ ] Button triggers tool call and renders result
- [ ] Safety constraints satisfied (no free-form inputs, response limits)
- [ ] README updated
