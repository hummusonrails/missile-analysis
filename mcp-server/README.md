# SirenWise MCP Server

MCP server for [Poke](https://poke.com) providing conversational access to
SirenWise missile alert analysis. Default city: Modi'in Maccabim Reut.

## Tools

- **get_daily_context** — Today's alerts vs 7-day and 30-day averages
- **get_sleep_impact** — Nighttime alerts (10 PM-6 AM) with deep sleep flags
- **get_clustering** — Isolated alerts vs barrages within time windows
- **get_streak** — Days since last alert, streak-breaker detection

## Local Development

```bash
cd mcp-server
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in TURSO values
python server.py
```

## Deploy to VPS

```bash
# 1. Create skill directory
contabo ssh "mkdir -p /home/openclaw/.openclaw/skills/sirenwise-mcp"

# 2. Deploy files
contabo deploy sirenwise-mcp --from=./mcp-server

# 3. Set up venv and install deps
contabo ssh "cd /home/openclaw/.openclaw/skills/sirenwise-mcp && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"

# 4. Generate API key and set env
contabo ssh 'echo "MCP_API_KEY=$(python3 -c \"import secrets; print(secrets.token_hex(32))\")" > /home/openclaw/.openclaw/skills/sirenwise-mcp/.env && chmod 600 /home/openclaw/.openclaw/skills/sirenwise-mcp/.env'
contabo ssh 'echo "TURSO_DB_URL=https://missile-analysis-hummusonrails.aws-us-east-1.turso.io" >> /home/openclaw/.openclaw/skills/sirenwise-mcp/.env'
contabo ssh 'echo "TURSO_READ_TOKEN=<your-read-only-token>" >> /home/openclaw/.openclaw/skills/sirenwise-mcp/.env'

# 5. Install systemd services
contabo ssh "sudo cp /home/openclaw/.openclaw/skills/sirenwise-mcp/sirenwise-mcp.service /etc/systemd/system/"
contabo ssh "sudo cp /home/openclaw/.openclaw/skills/sirenwise-mcp/sirenwise-mcp-tunnel.service /etc/systemd/system/"
contabo ssh "sudo systemctl daemon-reload && sudo systemctl enable --now sirenwise-mcp sirenwise-mcp-tunnel"

# 6. Verify
contabo ssh "systemctl status sirenwise-mcp sirenwise-mcp-tunnel"
```

## Tests

```bash
cd mcp-server && source venv/bin/activate
PYTHONPATH=. python -m pytest tests/ -v
```
