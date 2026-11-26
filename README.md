# Montador de painéis elétricos — versão em nuvem

Esta é a versão do Montador para rodar no seu próprio servidor. Os projetos ficam num banco de dados e a equipe da empresa trabalha junta.

O que muda em relação ao arquivo HTML que roda no navegador:

| | Arquivo HTML | Versão em nuvem |
|---|---|---|
| Onde ficam os projetos | Só no navegador | Banco de dados (PostgreSQL ou SQLite) |
| Acesso | Um computador | Qualquer computador ou celular, com login |
| Equipe | — | Empresa com código de convite, administradores e membros |
| Salvamento | Manual | Automático a cada alteração, mais versões manuais |
| Histórico | — | Até 50 versões por projeto, com autor e data, e restauração |
| Configurações da empresa | Por navegador | Compartilhadas: logos, dados da empresa e tema |
| Edição simultânea | — | Aviso quando outra pessoa alterou o projeto |

Os cálculos, a vista 3D, os diagramas, a simulação e as exportações (PDF, Excel, 3D) são os mesmos do app.

> **Leitura de diagramas com IA:** na versão em nuvem, a importação de diagramas funciona pela leitura de texto (PDF, SVG, DXF, TXT). A leitura de fotos com IA existe apenas no app publicado dentro do Claude.

---

## 1. Estrutura

```
app/app.html        → o app (o mesmo HTML do Montador)
app/cloud.js        → integração com a nuvem: login, salvamento, projetos e equipe
src/server.js       → servidor e API
src/db.js           → PostgreSQL ou SQLite
src/auth.js         → senhas (scrypt) e sessão por cookie assinado
migrations/*.sql    → tabelas do banco (aplicadas automaticamente)
build.js            → gera a pasta public/ com o app e as bibliotecas locais
Dockerfile, docker-compose.yml, .env.example
```

Requisitos: **Node.js 22.5 ou superior** e, em produção, **PostgreSQL 13 ou superior**.

---

## 2. Testar no seu computador (sem Docker)

```bash
npm install
npm run dev
```

Abra `http://localhost:8080`, clique em **Criar conta** e informe o nome da empresa.

O modo `dev` usa SQLite, num arquivo em `data/dev.db`, e não precisa de PostgreSQL.

---

## 3. Colocar no ar com Docker (servidor próprio, VPS ou nuvem)

1. Copie o modelo de configuração e edite os segredos:
   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # use como SESSION_SECRET
   ```
   No `.env`, troque `POSTGRES_PASSWORD` e `SESSION_SECRET`.
2. Suba o app e o banco:
   ```bash
   docker compose up -d --build
   ```
3. Configure HTTPS (seção 5) e acesse pelo seu domínio.

Para atualizar depois:

```bash
docker compose up -d --build
```

O banco fica no volume `pgdata` e não é apagado ao atualizar.

---

## 4. Provedores de nuvem (sem Docker Compose)

Em todos os casos o app precisa de um banco PostgreSQL e destas variáveis de ambiente:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `postgres://usuario:senha@host:5432/banco` (fornecida pelo provedor) |
| `PGSSL` | `require` (bancos gerenciados) ou `disable` (rede interna) |
| `SESSION_SECRET` | 64 caracteres aleatórios |
| `NODE_ENV` | `production` |
| `ALLOW_SIGNUP` | `1` permite criar empresas novas; `0` permite entrar só com convite |

Comandos: build `npm install --include=dev && npm run build`, início `npm start`. A porta vem da variável `PORT`, que o provedor define.

> Use `--include=dev`: com `NODE_ENV=production`, o `npm install` pularia as bibliotecas que o build copia para o app (3D, PDF, Excel).

- **Render:** crie um *PostgreSQL* e um *Web Service* a partir do repositório, preencha as variáveis e use o caminho de verificação `/api/health`.
- **Railway:** adicione um *PostgreSQL* ao projeto e use `${{Postgres.DATABASE_URL}}` em `DATABASE_URL`.
- **Fly.io:** `fly launch` (detecta o Dockerfile), depois `fly postgres create`, `fly postgres attach` e `fly secrets set SESSION_SECRET=...`.
- **Azure:** use *App Service* (Linux, Node 22 ou contêiner) com *Azure Database for PostgreSQL – Flexible Server* e `PGSSL=require`.
- **AWS:** use *App Runner* ou *ECS* com a imagem do Dockerfile, mais *RDS PostgreSQL* e `PGSSL=require`.
- **Servidor único sem PostgreSQL:** é possível usar `DATABASE_URL=sqlite:/caminho/persistente/app.db`, com um disco persistente. Atende bem equipes pequenas num único servidor. Não use SQLite com várias instâncias do app.

---

## 4.1 Banco de dados no Supabase

O Supabase é um PostgreSQL gerenciado, com backups, painel web e plano gratuito para testes. O Montador funciona com ele sem mudanças no código: basta apontar `DATABASE_URL` para o Supabase.

**Criar o banco**

1. Em **supabase.com**, crie uma conta e clique em **New project**.
2. Escolha a organização e dê um nome ao projeto, por exemplo `montador-paineis`.
3. Crie uma **Database Password** forte e guarde-a: ela vai na `DATABASE_URL`.
4. Em **Region**, escolha a mais próxima dos usuários e do servidor do app (para o Brasil, **South America (São Paulo)**).
5. Clique em **Create new project** e aguarde alguns minutos.

**Copiar o endereço de conexão**

1. No topo do painel do projeto, clique em **Connect**.
2. Em **Connection String**, escolha o modo **Session pooler** e copie o endereço. Ele tem esta forma:
   ```
   postgresql://postgres.abcdefghijklmn:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
   ```
3. Troque `[YOUR-PASSWORD]` pela senha do banco, sem os colchetes.

> **Por que o "Session pooler":** a conexão direta (`db.xxxx.supabase.co`) usa só IPv6, que muitos provedores (Render, Railway, Docker em VPS) não alcançam. O pooler funciona em IPv4 e aceita as transações do Montador.
>
> **Senha com símbolos** (`@ # / : ? %` etc.): codifique-os no endereço. Por exemplo, `@` vira `%40` e `#` vira `%23`. Outra opção é criar uma senha só com letras e números.

**Configurar o app**

| Variável | Valor |
|---|---|
| `DATABASE_URL` | o endereço do *Session pooler* com a senha |
| `PGSSL` | `require` (o app também detecta o Supabase e ativa o SSL sozinho) |
| `PGPOOL_MAX` | `5` (limite de conexões por instância, adequado aos planos do Supabase) |

Na primeira inicialização, o servidor cria as tabelas sozinho. Elas aparecem no Supabase em **Table Editor**: `orgs`, `users`, `projects`, `project_versions`, `org_settings` e `audit_log`.

**Segurança no Supabase**

- A migração `002_rls.pg.sql` ativa o **Row Level Security** em todas as tabelas. Assim, a API automática do Supabase (chaves *anon*/*publishable*) **não acessa** os dados. Tudo passa pelo servidor do Montador, que aplica o login e as permissões da empresa.
- Não use as chaves de API do Supabase no app: o Montador conecta direto no banco pela `DATABASE_URL`, que deve ficar só nas variáveis de ambiente do servidor.
- O Supabase pode avisar que as tabelas têm RLS **sem políticas**. Isso é intencional e significa "ninguém acessa pela API pública".

**Plano e backups**

- No plano gratuito, o projeto é **pausado após um período sem uso** e não tem backups diários. Serve para testar.
- Para uso real, use um plano pago, que mantém o projeto ativo e faz **backups diários** (em **Database › Backups**). Confira os limites e preços atuais no site do Supabase.
- Backup manual a qualquer momento:
  ```bash
  pg_dump "postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" | gzip > backup.sql.gz
  ```

**Usar o Supabase com Docker em servidor próprio**

Com o banco no Supabase, o contêiner do PostgreSQL do `docker-compose.yml` não é necessário:

```bash
docker build -t montador .
docker run -d --name montador -p 8080:8080 --restart unless-stopped \
  -e NODE_ENV=production -e SESSION_SECRET=SEU_SEGREDO \
  -e DATABASE_URL="postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" \
  -e PGSSL=require -e PGPOOL_MAX=5 montador
```

---

## 5. HTTPS

O login usa cookie seguro e exige HTTPS em produção (`COOKIE_SECURE=1`). Use um proxy na frente do app:

**Caddy (certificado automático):**
```
paineis.suaempresa.com.br {
  reverse_proxy localhost:8080
}
```

**Nginx + Certbot:** faça `proxy_pass http://127.0.0.1:8080;` com `proxy_set_header X-Forwarded-Proto $scheme;` e `client_max_body_size 20m;`, porque projetos com logos podem ter alguns MB.

Os provedores da seção 4 já entregam HTTPS.

Só para testar em `http://localhost` com `NODE_ENV=production`, use `COOKIE_SECURE=0`.

---

## 6. Primeiro acesso e equipe

1. A primeira pessoa clica em **Criar conta**, informa o **nome da empresa** e vira **administradora**.
2. No botão com o nome dela, no topo, aparece o **código de convite**.
3. Os colegas clicam em **Criar conta** e informam esse código. Eles entram na mesma empresa e veem os mesmos projetos.
4. O administrador pode promover membros, removê-los e gerar um código novo (o anterior deixa de valer).

Depois de cadastrar a equipe, você pode definir `ALLOW_SIGNUP=0` para impedir a criação de novas empresas no seu servidor.

### Esqueci a senha

- **Membro da equipe:** o administrador entra, clica no nome dele (topo) › **Equipe** › **Gerar senha provisória** ao lado da pessoa. A pessoa entra com essa senha e troca no próprio menu de conta, em **Trocar senha**.
- **Único administrador:** no painel do servidor, crie as variáveis `RESET_PASSWORD_EMAIL` (o e-mail da conta) e `RESET_PASSWORD_NEW` (a nova senha, com no mínimo 8 caracteres) e reinicie o serviço. No log aparece "senha de … redefinida". Entre com a nova senha e **apague as duas variáveis** em seguida.
- No cadastro, a senha é digitada duas vezes e há o botão **Mostrar**, para evitar erros de digitação.

---

## 6.1 Instalar como aplicativo (ícone na área de trabalho ou na tela inicial)

O site é um **aplicativo instalável** (PWA): tem ícone próprio, abre em janela própria, sem barra de endereço, e carrega mais rápido.

- **Computador (Chrome/Edge):** use o botão **Instalar app** no topo do Montador, ou o ícone de instalar na barra de endereço.
- **Android (Chrome):** use o botão **Instalar app** ou o menu **⋮ › Instalar app**.
- **iPhone/iPad (Safari):** toque em **Compartilhar › Adicionar à Tela de Início**. O botão **Instalar app** mostra esse passo a passo.

Requisitos: o site precisa estar em **HTTPS**, como Render e os demais provedores já entregam.

Projetos e dados nunca ficam guardados no cache do aplicativo: sempre vêm do servidor. O cache guarda só a página e as bibliotecas, para abrir mais rápido.

Arquivos em `app/pwa/`: ícones (`icon-*.png`, `apple-touch-icon.png`, `favicon.ico`, `icon.svg`), `manifest.webmanifest` (nome, cores e atalhos), `sw.js` (service worker) e `pwa.js` (botão Instalar).

**Para usar o ícone da sua empresa:** substitua os arquivos PNG em `app/pwa/` mantendo os mesmos nomes e tamanhos:
- `icon-192.png` e `icon-512.png`: ícone normal;
- `icon-maskable-*.png`: ícone com margem de cerca de 20%, para os recortes redondos do Android;
- `apple-touch-icon.png`: 180×180, sem transparência.

Depois, faça o deploy de novo. Quem já instalou recebe o ícone novo nas próximas aberturas; em alguns aparelhos, só ao reinstalar.

---

## 7. Como os projetos são salvos

- **Salvar projeto** (menu Projeto) grava o projeto na nuvem e cria uma **versão** no histórico.
- Depois disso, cada alteração é salva sozinha em cerca de 2,5 segundos, e o indicador no topo mostra "Salvo na nuvem".
- **Abrir / gerenciar projetos** permite buscar, abrir, excluir, ver o **histórico**, restaurar uma versão e **enviar para a nuvem** os projetos que estavam só no navegador.
- Se duas pessoas editarem o mesmo projeto, quem salvar por último recebe um aviso. Ao usar **Salvar projeto**, a versão dela é gravada, e a anterior continua no histórico.
- Logos, dados da empresa e tema, nas Configurações, são da empresa inteira.
- Projetos excluídos ficam marcados no banco (`deleted_at`) e podem ser recuperados por SQL.

---

## 8. Backup e restauração

**PostgreSQL com Docker:**
```bash
docker compose exec db pg_dump -U montador montador | gzip > backup-$(date +%F).sql.gz
gunzip -c backup-AAAA-MM-DD.sql.gz | docker compose exec -T db psql -U montador montador
```

Programe o backup diário (cron) e guarde cópias fora do servidor. Os provedores gerenciados (Render, Railway, Azure, AWS RDS) também oferecem backups automáticos: ative-os.

**SQLite:** copie o arquivo `.db` com o app parado, ou use `sqlite3 app.db ".backup backup.db"`.

---

## 9. Atualizar o app (novas versões do Montador)

1. Substitua `app/app.html` pelo novo HTML do Montador. Use o arquivo `quadro-comando.html`, que carrega as bibliotecas da internet; o build troca esses endereços pelas cópias locais.
2. Rode `npm run build`, ou refaça a imagem com `docker compose up -d --build`.

O `build.js` adiciona a integração com a nuvem automaticamente.

---

## 10. API (para integrações)

Todas as rotas ficam em `/api`, usam JSON e exigem login (cookie), exceto `health`, `auth/register` e `auth/login`.

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/health` | Verificação do serviço e do banco |
| POST | `/api/auth/register` | `{name,email,password,org_name}` ou `{…,invite_code}` |
| POST | `/api/auth/login` / `/api/auth/logout` | Entrar / sair |
| GET | `/api/me` | Usuário atual |
| PUT | `/api/me/password` | `{current,password}` |
| GET | `/api/org` | Empresa e equipe (o código de convite só aparece para administradores) |
| POST | `/api/org/invite/rotate` | Novo código de convite (administrador) |
| PUT / DELETE | `/api/org/members/:id` | Mudar perfil / remover membro (administrador) |
| GET / PUT | `/api/settings` | Configurações da empresa |
| GET / POST | `/api/projects` | Listar (`?q=busca`) / criar `{name,data}` |
| GET / PUT / DELETE | `/api/projects/:id` | Abrir / salvar `{data,name,version,note,base_updated_at}` / excluir |
| GET | `/api/projects/:id/versions` | Histórico |
| POST | `/api/projects/:id/restore/:versionId` | Restaurar versão |

---

## 11. Segurança

- **Senhas:** scrypt com sal individual. As sessões ficam em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção, com validade de 14 dias (`SESSION_DAYS`).
- **Tentativas de login:** limitadas por IP. A API aceita só JSON da mesma origem, como proteção contra CSRF.
- **Cabeçalhos:** CSP, HSTS (com HTTPS), `nosniff` e `frame-ancestors 'self'`.
- **Isolamento:** cada empresa só enxerga os próprios projetos. Login, cadastro e exclusões ficam registrados em `audit_log`.
- **Segredos:** nunca publique o `.env`. Troque o `SESSION_SECRET` se suspeitar de vazamento; isso desconecta todos os usuários.
- **Limite de tentativas:** o controle de login fica na memória do processo. Com várias instâncias, use também a proteção do seu provedor ou proxy.

---

## 12. Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Login volta para a tela de entrada | Site sem HTTPS com `COOKIE_SECURE=1`. Ative HTTPS ou, só em teste local, use `COOKIE_SECURE=0`. |
| "Servidor indisponível" no topo | O app não alcança a API. Verifique os logs (`docker compose logs app`) e o `/api/health`. |
| Erro de SSL ao conectar no banco | Ajuste `PGSSL=require` (bancos gerenciados) ou `PGSSL=disable` (rede interna). |
| Supabase: `ENETUNREACH`, `ENOTFOUND` ou tempo esgotado | Use o endereço do **Session pooler** (`…pooler.supabase.com`), não a conexão direta `db.xxxx.supabase.co`, que usa só IPv6. |
| Supabase: `password authentication failed` | Senha errada ou com símbolos sem codificação. O usuário do pooler é `postgres.SEU_PROJETO`, não só `postgres`. |
| Supabase: projeto pausado | O plano gratuito pausa por inatividade. Reative no painel ou use um plano pago. |
| Supabase: muitas conexões | Mantenha `PGPOOL_MAX=5` e não suba muitas instâncias do app. |
| "Arquivo grande demais" ao salvar | Logo muito pesado. Use um logo menor ou aumente `BODY_LIMIT` e o limite do proxy. |
| `node:sqlite` não encontrado | Node abaixo da versão 22.5. Atualize ou use PostgreSQL. |
| Build falha com "faltando … rode npm install" | O build rodou sem as bibliotecas de desenvolvimento. Use `npm install --include=dev && npm run build`. |

As fórmulas e o dimensionamento do Montador são de referência para pré-projeto: os projetos finais devem ser verificados e assinados por profissional habilitado.
