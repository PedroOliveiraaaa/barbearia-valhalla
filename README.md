# Barbearia Valhalla — versão completa

## Stack
- React + TypeScript + Vite
- Node.js + Express
- SQLite (`better-sqlite3`)
- JWT para painel administrativo

## Rodar
Requer Node.js 20+.

```bash
npm install
npm run dev
```

Site: http://localhost:5173
Painel: http://localhost:5173/admin

Login inicial:
- usuário: `admin@valhalla.local`
- senha: `admin123`

**Antes de publicar**, defina `ADMIN_PASSWORD` e `JWT_SECRET` como variáveis de ambiente.

## Funcionalidades
Cliente:
- serviços, barbeiros, calendário, horários disponíveis;
- prevenção de duplicidade no banco;
- dados do cliente;
- confirmação;
- WhatsApp;
- mapa;
- responsivo.

Administrador:
- login;
- agenda;
- confirmar/concluir/cancelar;
- cadastro de serviços;
- consulta de barbeiros.

## Para produção
Ainda é recomendável adicionar:
- recuperação de senha;
- CRUD completo de barbeiros;
- horários individuais, folgas, feriados e bloqueios pelo painel;
- edição/exclusão de serviços;
- paginação e filtros;
- HTTPS e domínio;
- backups do SQLite ou migração para PostgreSQL;
- envio de e-mail/SMS;
- integração de calendário;
- rate limiting, validação mais rígida e logs.
