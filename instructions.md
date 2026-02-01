# MCP-Apps Anleitungen (Repo-spezifisch)

Diese Anleitung beschreibt Schritt für Schritt, wie in diesem Repo eine neue MCP-App erstellt wird. Sie basiert auf der vorhandenen Hello-World-App (`api/server.js`) und der Spezifikation in `MCP_Apps_spec`. Ziel: reproduzierbar, zuverlässig, mit klaren Konventionen für weitere Apps in diesem Server.

## 1) Konzept: Was ist eine MCP-App?

Eine MCP-App ist eine UI-Ressource (`ui://...`), die vom Host (z. B. Claude) in einem isolierten iframe gerendert wird. Die App kommuniziert über JSON-RPC (postMessage) mit dem Host und kann MCP-Tools aufrufen. Dazu braucht es **zwei Dinge**:

1) **Tool-Definition mit UI-Metadaten**  
   Das Tool verweist in `_meta.ui.resourceUri` auf die UI-Ressource.  
2) **UI-Resource-Handler**  
   Der Server liefert bei der `ui://...` Resource HTML (inkl. JS/CSS).  

So ist die App eng in den Chat eingebettet und kann bidirektional mit dem Host interagieren. Details in `MCP_Apps_spec`.

## 2) Architektur im Repo (Status Quo)

Der MCP-Server läuft in `api/server.js`. Die Hello-World-App zeigt das Muster:

- **Tool**: `hello_world`
- **UI Resource**: `ui://hello_app_panel`
- **Inline HTML**: `helloAppHtml` (String)
- **Host-Kommunikation**: `window.parent.postMessage(...)` und `message`-Listener für `tools/call` Ergebnisse.

Weitere Apps werden als zusätzliche Tools + Ressourcen im gleichen Server registriert.

## 3) Konventionen für neue Apps

### 3.1 Benennung

- Resource-URI: `ui://<app_slug>/<optional-file>` oder `ui://<app_slug>`  
  Beispiel: `ui://hello_app_panel` (bestehend).
- Tool-Namen: `snake_case`, z. B. `weather_panel` oder `stock_quote`.
- Für mehrere Apps: prefixed Tools, z. B. `sales_dashboard.get_data` (optional).

### 3.2 Grenzen & Sicherheitsannahmen

- UI ist **sandboxed** (iframe, keine DOM-Zugriffe auf Host).
- Komplette UI muss im zulässigen Größenlimit bleiben:
  - In diesem Repo gilt `MAX_UI_BYTES = 20 * 1024`.
- Tool-Ausgaben werden auf `MAX_MESSAGE_LENGTH = 2048` gekürzt.
- UI sollte **robust** gegenüber Ausfällen sein (Fehlertext anzeigen).

### 3.3 JSON-RPC Kommunikation (Client <-> Host)

Die App spricht mit dem Host über JSON-RPC:

- **Tool Call (Client → Host)**:
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "hello_world",
      "arguments": { "style": "friendly" }
    }
  }
  ```
- **Tool Result (Host → Client)**:
  Der Host sendet `result` oder `toolResult`.  
  Die Hello-World-App nutzt eine defensive Auswertung:
  - Wenn `content` enthält `type: "text"`, wird das gerenderte Ergebnis angezeigt.
  - JSON im Text wird geparst (z. B. `{ "message": "..." }`).

⚠️ **Wichtig**: Eingehende Nachrichten immer validieren (JSON-RPC 2.0, erwartete Felder).

## 4) Schritt-für-Schritt: Neue MCP-App hinzufügen

### Schritt 1: Tool + Resource URI festlegen

Beispiel:

- Tool-Name: `my_new_tool`
- Resource URI: `ui://my_new_app`

### Schritt 2: UI-HTML definieren

Im Server wird HTML als String geliefert.  
Empfehlung: **Jede App in klar getrennten Variablen** halten, z. B.:

```js
const MY_NEW_APP_URI = "ui://my_new_app";
const myNewAppHtml = `<!doctype html>...`;
```

Wenn das HTML **zu groß** wird, kann es ausgelagert werden (z. B. via Build-Step und ReadFile wie im Spec).  
Für dieses Repo gilt aber weiterhin: **UI unter 20 KB** halten.

### Schritt 3: Resource registrieren

Muster (wie `hello_app_panel`):

```js
server.resource(
  "my_new_app",
  MY_NEW_APP_URI,
  { mimeType: "text/html", description: "My new MCP App" },
  async () => ({
    contents: [
      {
        uri: MY_NEW_APP_URI,
        mimeType: "text/html",
        text: myNewAppHtml,
      },
    ],
  }),
);
```

### Schritt 4: Tool im `tools/list` veröffentlichen

Im Handler für `tools/list` das neue Tool ergänzen:

```js
{
  name: "my_new_tool",
  description: "Does something useful.",
  inputSchema: {
    type: "object",
    properties: { ... },
    additionalProperties: false,
  },
  _meta: { ui: { resourceUri: MY_NEW_APP_URI } },
}
```

Damit weiß der Host: dieses Tool hat eine UI.

### Schritt 5: Tool-Ausführung in `tools/call`

Im `tools/call` Handler:

1. Input validieren (z. B. mit `zod`).
2. Fehler sauber als JSON-String zurückgeben (siehe `buildError`).
3. Ergebnis als `content` mit `type: "text"` zurückliefern.

Beispiel:

```js
return {
  content: [
    { type: "text", text: JSON.stringify({ message: "OK" }) },
  ],
};
```

### Schritt 6: UI-Logik im HTML

Im HTML/JS:

- `window.parent.postMessage` für Tool-Calls verwenden.
- `window.addEventListener("message", ...)` für Tool-Results.
- Ergebnis gut sichtbar anzeigen.
- `button.disabled` o. ä. während Requests setzen.

## 5) Best Practices & Zuverlässigkeit

1. **Input-Validierung**  
   Nutze `zod`-Schemas (wie `helloWorldInputSchema`) für alle Tool-Inputs.

2. **Fehlerhandling**  
   Verwende konsistente Fehlerformate:
   ```json
   { "error": { "code": "BAD_REQUEST", "message": "..." } }
   ```
   Der UI-Parser sollte diese Struktur erkennen.

3. **UI-Größe**  
   - Max 20 KB HTML (siehe `MAX_UI_BYTES`).
   - Minimiere Inline-CSS/JS.

4. **Idempotenz & Latenz**  
   - Der Host kann Tools mehrfach aufrufen.
   - UI sollte Requests sauber serialisieren (wie `pending` Map).

5. **Namensräume**  
   Für mehrere Apps im selben Server lohnt es sich, Namensräume zu nutzen:
   - `sales.get_overview`, `sales.get_details`
   - Resource: `ui://sales/dashboard`

6. **Health & Debug**  
   Der Server unterstützt `GET /health`.  
   Debug-Modus kann Fehler forcieren (`MCP_DEBUG_MODE=true` oder `x-mcp-debug`).

## 6) Checkliste vor Commit

- [ ] Neues Tool in `tools/list` registriert  
- [ ] `tools/call` Handler implementiert  
- [ ] UI Resource (`ui://`) registriert  
- [ ] UI-HTML unter Größenlimit  
- [ ] Fehlerstruktur konsistent  
- [ ] Lokales Testen (`/health` oder JSON-RPC Request)  

## 7) Minimaler Request zum Testen

Ein JSON-RPC Tool Call (z. B. via Postman oder curl):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "hello_world",
    "arguments": { "style": "friendly" }
  }
}
```

Erwartetes Ergebnis: Text-Content mit `"Hello from MCP! 👋"`.

---

Diese Anleitung ist als **Context für Coding Agents** gedacht und reflektiert die aktuelle Repo-Implementierung plus die MCP-App Spezifikation.
