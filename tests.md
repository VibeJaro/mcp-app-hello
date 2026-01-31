# Tests für den MCP-Server (Vercel)

Diese Schritte sind absichtlich einfach gehalten und funktionieren direkt gegen deine Vercel-URL.

## 1) Prüfe, dass die Deployment-URL erreichbar ist

Ersetze `<DEPLOYMENT_URL>` mit deiner echten Vercel-URL (z. B. `https://dein-projekt.vercel.app`).

```bash
curl -sS https://<DEPLOYMENT_URL> -I
```

Wenn du einen HTTP-Status wie `200`, `307` oder `308` siehst, ist die Domain erreichbar.

## 2) Prüfe den MCP-Streamable-HTTP Endpoint (`/mcp`)

Der MCP-Server erwartet JSON-RPC. Mit diesem Befehl rufst du `tools/list` ab:

```bash
curl -sS https://<DEPLOYMENT_URL>/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Erwartung:** In der Antwort sollte ein Tool mit dem Namen `hello_world` erscheinen.

### Teste direkt den Tool-Call

```bash
curl -sS https://<DEPLOYMENT_URL>/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hello_world","arguments":{"style":"friendly"}}}'
```

**Erwartung:** In der Antwort steht `Hello from MCP! 👋`.

## 3) Prüfe den SSE Endpoint (`/sse`)

SSE wird für Streaming genutzt. Ein sehr einfacher Check ist:

```bash
curl -sS https://<DEPLOYMENT_URL>/sse -I
```

Du solltest einen Status wie `200` sehen und typischerweise `text/event-stream` im `content-type`.

Wenn du einen vollständigen SSE-Client testen willst, brauchst du das MCP-SDK. Im Repo fehlen diese Dependencies aktuell, daher **musst du sie lokal installieren**:

```bash
pnpm add -D @modelcontextprotocol/sdk
node scripts/test-client.mjs https://<DEPLOYMENT_URL>
```

## 4) UI-Panel (MCP Apps) testen

Wenn dein Host MCP Apps unterstützt (z. B. Claude Desktop mit MCP Apps), sollte nach einem `tools/list` und `tools/call` automatisch das Panel erscheinen.

Die UI-Resource ist:

```
ui://hello_app_panel
```

Wenn das Panel **nicht** erscheint:

- Stelle sicher, dass dein Host MCP Apps unterstützt.
- Prüfe, ob der Host die URL mit `/mcp` konfiguriert hat (nicht `/api/server`).

## 5) Vercel-Logs prüfen

Bei Problemen ist der schnellste Weg die Logs:

```bash
vercel logs <DEPLOYMENT_URL>
```

Suche dort nach Fehlern wie `BAD_REQUEST`, `INTERNAL_ERROR` oder Exceptions.

---

# Mögliche Fehlerquellen im Repo

1) **Test-Skripte benötigen das MCP-SDK**
   - Die Dateien in `scripts/` importieren `@modelcontextprotocol/sdk`, aber das Paket ist nicht in `package.json` eingetragen. Das führt lokal zu `Cannot find module`.

2) **Host-App erreicht den Server nicht**
   - Stelle sicher, dass der Host `/mcp` als Endpoint nutzt. In `vercel.json` werden alle Pfade auf `/api/server` umgeschrieben, aber MCP erwartet trotzdem den Pfad `/mcp`.

3) **Endpoint-Verwechslung**
   - Für Streaming over HTTP nutze `/mcp`.
   - Für SSE nutze `/sse`.

Wenn du mir sagst, welche Host-App du verwendest, kann ich dir die genaue Konfiguration dafür geben.
