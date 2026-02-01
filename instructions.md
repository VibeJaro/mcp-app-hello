# MCP-Apps Anleitungen (Repo-agnostisch)

Diese Anleitung beschreibt Schritt für Schritt, wie du eine MCP-App erstellst. Sie ist **repo-unabhängig** und kann als Kontext für Coding Agents in beliebigen Projekten genutzt werden. Sie fasst die MCP-App-Spezifikation zusammen und beschreibt eine robuste Standard-Implementierung.

## 1) Konzept: Was ist eine MCP-App?

Eine MCP-App ist eine UI-Ressource (`ui://...`), die vom Host (z. B. Claude) in einem isolierten iframe gerendert wird. Die App kommuniziert über JSON-RPC (postMessage) mit dem Host und kann MCP-Tools aufrufen. Dazu braucht es **zwei Dinge**:

1) **Tool-Definition mit UI-Metadaten**  
   Das Tool verweist in `_meta.ui.resourceUri` auf die UI-Ressource.  
2) **UI-Resource-Handler**  
   Der Server liefert bei der `ui://...` Resource HTML (inkl. JS/CSS).  

So ist die App eng in den Chat eingebettet und kann bidirektional mit dem Host interagieren. Details in `MCP_Apps_spec`.

## 2) Architektur einer MCP-App (Standard-Pattern)

Eine MCP-App besteht aus:

- **Tool** mit `_meta.ui.resourceUri`
- **UI-Resource**, die HTML (inkl. JS/CSS) liefert
- **Client-Skript**, das per `postMessage` JSON-RPC nutzt (z. B. `tools/call`)

Weitere Apps können im selben Server registriert werden, jeweils mit eigenem Tool + UI-Resource.

## 3) Konventionen für neue Apps

### 3.1 Benennung

- Resource-URI: `ui://<app_slug>/<optional-file>` oder `ui://<app_slug>`  
  Beispiel: `ui://hello_app_panel` (bestehend).
- Tool-Namen: `snake_case`, z. B. `weather_panel` oder `stock_quote`.
- Für mehrere Apps: prefixed Tools, z. B. `sales_dashboard.get_data` (optional).

### 3.2 Grenzen & Sicherheitsannahmen

- UI ist **sandboxed** (iframe, keine DOM-Zugriffe auf Host).
- Komplette UI sollte ein Größenlimit einhalten (Richtwert: ≤ 20 KB HTML).
- Tool-Ausgaben sollten gekürzt werden (Richtwert: ≤ 2048 Zeichen).
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
  Eine robuste App wertet defensiv aus:
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

Wenn das HTML **zu groß** wird, kann es ausgelagert werden (z. B. Build-Step + ReadFile).  
Empfehlung: **UI unter 20 KB** halten, um Hosts zuverlässig zu bedienen.

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

1. Input validieren (z. B. mit `zod` oder JSON-Schema).
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
   Nutze strikte Schemas für alle Tool-Inputs.

2. **Fehlerhandling**  
   Verwende konsistente Fehlerformate:
   ```json
   { "error": { "code": "BAD_REQUEST", "message": "..." } }
   ```
   Der UI-Parser sollte diese Struktur erkennen.

3. **UI-Größe**  
   - Max 20 KB HTML (Richtwert).
   - Minimiere Inline-CSS/JS.

4. **Idempotenz & Latenz**  
   - Der Host kann Tools mehrfach aufrufen.
   - UI sollte Requests sauber serialisieren (wie `pending` Map).

5. **Namensräume**  
   Für mehrere Apps im selben Server lohnt es sich, Namensräume zu nutzen:
   - `sales.get_overview`, `sales.get_details`
   - Resource: `ui://sales/dashboard`

6. **Health & Debug**  
   Implementiere einen `GET /health` Endpoint und optional Debug-Schalter für Fehlerzustände.

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

Erwartetes Ergebnis: Text-Content mit `"Hello from MCP! 👋"` oder einem äquivalenten Ergebnis.

---

Diese Anleitung ist als **Context für Coding Agents** gedacht und reflektiert die MCP-App Spezifikation sowie ein bewährtes Standard-Pattern.
