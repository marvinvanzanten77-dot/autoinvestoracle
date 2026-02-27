# Auto Invest Oracle

**Last Updated:** February 27, 2026

## Exchange Connections (WIP)

Dit project bevat een eerste scaffolding voor exchange‑koppelingen (Bitvavo, Kraken, Coinbase, Bybit).
De implementatie is gericht op structuur en beveiligde opslag, niet op volledige functionaliteit.

### Lokale setup

1. Maak een `.env` op basis van `.env.example`.
2. Vul `ENCRYPTION_KEY` met een 32‑byte key (hex of base64).
3. Kies `STORAGE_DRIVER=file` voor lokale tests.

### API routes

- `POST /api/exchanges/connect`
- `POST /api/exchanges/disconnect`
- `POST /api/exchanges/sync`
- `GET /api/exchanges/status?userId=...`
- `GET /api/exchanges/_health`

### Opmerking

De connecties bewaren alleen versleutelde secrets (AES‑256‑GCM). OAuth is nog een placeholder.
