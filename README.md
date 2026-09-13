# Matos Negócios Imobiliários — Versão 6

## Novidades
- Login administrativo em `/login`
- Painel em `/admin`
- Visão geral de imóveis
- Lista de imóveis
- Novo imóvel
- Edição de imóvel
- Publicar / despublicar
- Exclusão lógica de imóvel
- Upload de fotos
- Definir foto de capa
- Excluir foto
- Site público continua funcionando

## Antes de usar o painel
Execute no Supabase:
`SUPABASE_ADMIN_SETUP.sql`

Depois:
1. Crie um usuário em Authentication > Users.
2. Transforme esse usuário em administrador usando o comando SQL no final do arquivo.
3. Publique esta versão no GitHub/Vercel.
4. Acesse `/login`.

## Segurança
- Visitantes continuam vendo apenas imóveis publicados.
- Escrita no banco só é permitida para usuários autenticados com `role = 'admin'`.
- A chave secreta do Supabase não é usada no navegador.
