# Tests für den MCP-Server (Vercel)

Diese Schritte sind absichtlich einfach gehalten und funktionieren direkt gegen deine Vercel-URL.

## 1) Prüfe, dass die Deployment-URL erreichbar ist

Ersetze `<DEPLOYMENT_URL>` mit deiner echten Vercel-URL (z. B. `https://dein-projekt.vercel.app`).

**Einfachste Variante (nur Browser):**

1. Öffne `<DEPLOYMENT_URL>` im Browser.
2. Wenn eine Seite lädt oder eine Weiterleitung passiert, ist die Domain erreichbar.

## 2) Prüfe den MCP-Streamable-HTTP Endpoint (`/mcp`) ohne Programmier-Tools

Da du kein `curl` nutzen kannst, nimm bitte ein **Web-Tool im Browser**, z. B.:

- **Hoppscotch**: https://hoppscotch.io (kostenlos, im Browser)

### Schritt-für-Schritt mit Hoppscotch

1. Öffne https://hoppscotch.io  
2. Stelle die **Methode** auf **POST**.  
3. Setze die **URL** auf: `https://<DEPLOYMENT_URL>/mcp`  
4. Öffne den Tab **Headers** und füge hinzu:  
   - `content-type` → `application/json`  
5. Öffne den Tab **Body** und wähle **JSON**.  
6. Füge folgenden JSON-Inhalt ein und sende die Anfrage:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Erwartung:** In der Antwort sollte ein Tool mit dem Namen `hello_world` erscheinen.

### Tool direkt aufrufen (ebenfalls mit Hoppscotch)

Sende eine zweite Anfrage mit diesem JSON:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "hello_world",
    "arguments": {
      "style": "friendly"
    }
  }
}
```

**Erwartung:** In der Antwort steht `Hello from MCP! 👋`.

## 3) Prüfe den SSE Endpoint (`/sse`) ohne Programmier-Tools

SSE ist nur relevant, wenn dein Host es nutzt. Ein grober Check im Browser reicht:

1. Öffne `https://<DEPLOYMENT_URL>/sse` im Browser.  
2. Wenn keine offensichtliche Fehlermeldung erscheint (z. B. 404), ist der Endpoint erreichbar.  

Hinweis: Manche Browser zeigen bei SSE einfach eine leere Seite – das ist ok.

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

1. Öffne dein Projekt im Vercel-Dashboard.  
2. Gehe zu **Deployments → Logs**.  
3. Suche dort nach Fehlern wie `BAD_REQUEST`, `INTERNAL_ERROR` oder Exceptions.

---

# Mögliche Fehlerquellen im Repo

1) **Test-Skripte benötigen das MCP-SDK (nur für Entwickler)**
   - Die Dateien in `scripts/` importieren `@modelcontextprotocol/sdk`, aber das Paket ist nicht in `package.json` eingetragen. Das führt lokal zu `Cannot find module`.

2) **Host-App erreicht den Server nicht**
   - Stelle sicher, dass der Host `/mcp` als Endpoint nutzt. In `vercel.json` werden alle Pfade auf `/api/server` umgeschrieben, aber MCP erwartet trotzdem den Pfad `/mcp`.

3) **Endpoint-Verwechslung**
   - Für Streaming over HTTP nutze `/mcp`.
   - Für SSE nutze `/sse`.

Wenn du mir sagst, welche Host-App du verwendest, kann ich dir die genaue Konfiguration dafür geben.
