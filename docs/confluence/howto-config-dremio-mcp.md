# How to configure the Dremio MCP tools in VS Code (simple guide)

This short guide helps non-technical users set up the Dremio MCP helper in Visual Studio Code. The goal: explore and query Dremio data from your machine with minimal steps.

Keep this page handy and follow the steps in order.

**Quick summary**: create a Personal Access Token (PAT) in Dremio, save it securely, add a small config file (`mcp.json`) in your VS Code user settings, and use the helper (`npx @guillaume-galp/dremio-mcp-lite`) to query data.

---

## First Step — Create your Dremio Personal Access Token (do this first)

1. Open Dremio in your browser and log in: `https://datahub.ulysses.galpenergia.corp:9047/`
2. Click your avatar (profile picture) in the top-right and select **Settings** or **Account Settings**.
3. Look for **Personal Access Tokens** in the left sidebar.
4. Click **"+ New Token"**. Give it a clear name like "VSCode MCP" and optionally set an expiration date.
5. Copy the token now — you will not be able to see it again.
6. Store the token in a secure place (password manager) and in the next step put it into your `mcp.env` file.

If you need help finding the exact menu, ask your IT or Data team — they can point to where tokens are managed in Dremio.

---

## Prerequisites (short)

- Visual Studio Code installed.
- Node.js (LTS) so `npx` is available — this usually comes with Node.js.
- Dremio account and the Personal Access Token you created above.
- Access to Galp's corporate network (VPN if working remotely).

---

## Files and where they go

- VS Code user MCP settings: `%APPDATA%/Code/User/mcp.json` (Windows) or `$HOME/.config/Code/User/mcp.json` (Linux/macOS).
- Credentials file: choose a private file like `~/.mcp.env` and do not share it.

---

## Step 1 — Add the Dremio entry to your mcp.json (one small edit)

Open the `mcp.json` file in your VS Code user settings and add this small block under `servers`:

```json
"dremio": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@guillaume-galp/dremio-mcp-lite"],
  "envFile": "/home/<you>/.mcp.env",
  "gallery": true
}
```

- On Windows, use a path like `C:\\Users\\<you>\\AppData\\Roaming\\Code\\User\\mcp.json`.
- The `-y` flag lets `npx` install the helper automatically if it's not already on your machine.

---

## Step 2 — Create the mcp.env file and add your token (very important)

Create a new file at the path you used in `mcp.json` (example: `~/.mcp.env`) and add these three lines replacing the placeholders:

```bash
DREMIO_URL=https://datahub.ulysses.galpenergia.corp:9047
DREMIO_PAT=your_personal_access_token_here
DREMIO_REJECT_UNAUTHORIZED=false
```

**Important notes:**

- `DREMIO_URL`: Use Galp's Dremio URL (https://datahub.ulysses.galpenergia.corp:9047)
- `DREMIO_PAT`: Paste the Personal Access Token you created in the first step
- `DREMIO_REJECT_UNAUTHORIZED=false`: Required for corporate SSL certificates

Save the file and keep it private. On Linux/macOS run:

```bash
chmod 600 ~/.mcp.env
```

- On Windows, use a path like `C:\\Users\\<you>\\AppData\\Roaming\\Code\\User\\mcp.env` for the envFile.
- On Windows, keep the file in your user folder and do not commit it to Git.

---

## Step 3 — Start the MCP server from VS Code (click-based)

Now you need to start the MCP tool server so the Copilot agent can use it. Follow these simple UI steps:

1. In VS Code, open the **Command Palette** (press `Ctrl+Shift+P` on Windows/Linux or `Cmd+Shift+P` on Mac).
2. Type **"MCP: Start Server"** or **"MCP: Restart Servers"** and select it from the list.
3. VS Code will start all MCP servers listed in your `mcp.json` file (including the Dremio helper).
4. You should see a small notification in the bottom-right corner saying the servers started successfully.

If you don't see the MCP commands:

- Make sure you have saved the `mcp.json` file.
- Restart VS Code completely (close and reopen).
- Check that your `mcp.env` file exists at the path you specified in `mcp.json`.

The MCP server will now run in the background and be ready for the Copilot agent to use.

---

## Step 4 — Enable the Dremio tool for GitHub Copilot (click-based)

Now activate the Dremio tool so GitHub Copilot can use it:

1. In VS Code, open the **GitHub Copilot Chat** panel (click the chat icon in the left sidebar or press `Ctrl+Alt+I`).
2. Click the **tools icon** (⚙️) at the bottom of the chat panel.
3. Find **"Dremio"** in the list and make sure it's **checked/enabled**.
4. Close the settings panel.
5. The editor will open the agent configuration file automatically with the changes. Press `Ctrl+S` (or `Cmd+S` on Mac) to save it.

Verify it's working:

- In the Copilot Chat, type `@` and you should see the Dremio tools appear in the suggestions.
- Or ask Copilot: "What tools do you have access to?" and it should list Dremio tools like `catalog_browse`, `sql_query`, etc.

If the Dremio tool doesn't appear:

- Go back to Step 3 and restart the MCP servers.
- Make sure the `gallery` setting in your `mcp.json` is set to `true`.
- Restart VS Code and try again.

---

## Step 5 — Example usage: Query Dremio data with Copilot

Once configured, you can ask GitHub Copilot to explore and query Dremio data:

**Example prompts:**

1. **Browse the catalog:**
   > "Show me the available data sources in Dremio"

2. **Search for tables:**
   > "Find tables related to invoices in the ulysses1 source"

3. **Query data:**
   > "Count the number of invoices from the past month in ulysses1.sapisu.aug_contract_invoice"

4. **Get table schema:**
   > "Show me the schema of ulysses1.sapisu.aug_contract_invoice"

5. **Preview data:**
   > "Preview the first 10 rows of ulysses1.sapisu.aug_measured_consumptions_m"

The Copilot agent will use the Dremio MCP tools automatically to execute these requests.

---

## Available Dremio MCP Tools

The Dremio MCP helper provides six tools:

1. **catalog_browse** - Browse Dremio catalog structure (spaces, sources, folders)
2. **schema_get** - Get table schema information
3. **sql_query** - Execute SELECT queries (read-only, max 500 rows)
4. **table_preview** - Preview first 10 rows of a table
5. **search_catalog** - Search for tables by name
6. **explain_query** - Get query execution plans

**Security:** All tools are read-only. Only SELECT queries are allowed (no INSERT, UPDATE, DELETE, DROP).

---

## Troubleshooting (simple)

- **Authentication error**: Recreate the Personal Access Token in Dremio and update `mcp.env`.
- **Can't reach Dremio**: Check your VPN connection if working remotely. Galp's Dremio requires corporate network access.
- **SSL certificate errors**: Make sure `DREMIO_REJECT_UNAUTHORIZED=false` is set in your `mcp.env` file.
- **`npx` fails to install**: Try installing the package once with `npm i -g @guillaume-galp/dremio-mcp-lite`.
- **"limit can not exceed 500 rows"**: This is expected. Dremio limits queries to 500 rows maximum. Use WHERE clauses to filter data.
- **MCP server won't start**: Check the Output panel in VS Code (View > Output, select "MCP Server: dremio" from dropdown) for error messages.

---

## Security note

- Never commit `mcp.env` or your Personal Access Token to Git or share it unencrypted.
- Use a company password manager for long-term storage.
- The Dremio MCP tools are read-only and cannot modify data.
- All SQL queries are validated to ensure only SELECT statements are executed.

---

## Appendix: Complete mcp.json example

```json
{
  "servers": {
    "dremio": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@guillaume-galp/dremio-mcp-lite"],
      "envFile": "/home/<you>/.mcp.env",
      "gallery": true
    }
  }
}
```

---

## Related Resources

- Dremio Web UI: https://datahub.ulysses.galpenergia.corp:9047
- NPM Package: https://www.npmjs.com/package/@guillaume-galp/dremio-mcp-lite
- GitHub Repository: https://github.com/guillaume-galp/dremio-mcp-lite

---

## Support

For issues or questions:

- Check the troubleshooting section above
- Contact the Data Team in #data-platform Slack channel
- Create an issue in the GitHub repository
