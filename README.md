# Matos Negócios Imobiliários — Versão 9

## Captação de imóveis e proprietários

### Site público
Novas páginas:
- `/anuncie-seu-imovel`
- `/avaliacao-do-imovel`

O proprietário pode enviar:
- nome
- WhatsApp
- e-mail
- objetivo: vender / alugar
- tipo de imóvel
- cidade e bairro
- endereço ou referência
- valor pretendido
- descrição
- autorização para uso dos dados no atendimento

### Painel administrativo
Nova área:
- `Captações`

Funil:
- Novo contato
- Avaliação
- Documentação
- Autorizado
- Publicado
- Perdido

### Ficha do proprietário
Permite controlar:
- valor pretendido
- valor da avaliação
- comissão combinada
- próxima ação
- motivo de perda
- anotações
- histórico das etapas
- documentação recebida / pendente
- WhatsApp

### Documentos acompanhados
- Documento do proprietário
- Matrícula do imóvel
- IPTU / cadastro municipal
- Autorização para intermediação

### Conversão em imóvel
O botão `Criar imóvel sem redigitar` reaproveita:
- tipo
- finalidade
- cidade
- bairro
- descrição
- valor

O imóvel é criado como RASCUNHO.
Depois o administrador apenas completa fotos e demais dados e publica.

## Instalação

ANTES de publicar a Versão 9:

1. Abra `SUPABASE_CAPTACOES_SETUP.sql`.
2. Copie todo o conteúdo.
3. Execute no Editor SQL do Supabase.
4. Confirme que apareceu sucesso.
5. Só depois publique os arquivos no GitHub/Vercel.

## Segurança
- O visitante pode enviar uma captação.
- O visitante não consegue consultar a base de proprietários.
- Somente administrador autenticado pode visualizar, editar e converter captações.
