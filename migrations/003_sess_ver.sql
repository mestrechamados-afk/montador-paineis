-- Versão da sessão: troca/redefinição de senha incrementa e invalida logins antigos
ALTER TABLE users ADD COLUMN sess_ver INTEGER NOT NULL DEFAULT 0;
