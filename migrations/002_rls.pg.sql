-- Ativa Row Level Security em todas as tabelas (PostgreSQL / Supabase).
-- O servidor do Montador conecta com o usuário dono das tabelas e continua com acesso total.
-- Sem políticas definidas, a API automática do Supabase (PostgREST, chaves "anon" e "authenticated")
-- fica SEM acesso a estas tabelas — os dados só passam pelo servidor do Montador, que aplica login e permissões.
ALTER TABLE orgs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
