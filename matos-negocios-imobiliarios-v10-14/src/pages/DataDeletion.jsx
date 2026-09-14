import React from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';

export default function DataDeletion() {
  return (
    <main className="legal-page">
      <SeoHead
        title="Exclusão de Dados"
        description="Instruções para solicitar exclusão de dados da Matos Negócios Imobiliários."
        canonicalPath="/exclusao-de-dados"
        robots="noindex,follow"
      />

      <section className="legal-hero">
        <span className="eyebrow">Dados pessoais</span>
        <h1>Solicitação de exclusão de dados</h1>
        <p>
          Saiba como solicitar a exclusão de dados relacionados ao atendimento
          realizado pela Matos Negócios Imobiliários.
        </p>
      </section>

      <section className="section legal-content">
        <article>
          <h2>Como solicitar</h2>
          <p>
            Entre em contato pelos canais oficiais da Matos Negócios Imobiliários
            e informe que deseja solicitar a exclusão de seus dados pessoais.
          </p>
          <p>
            Para localizar o registro correto e evitar a exclusão de informações
            de outra pessoa, poderemos solicitar dados mínimos de confirmação,
            como nome, telefone, e-mail ou usuário do Instagram utilizado no
            atendimento.
          </p>

          <h2>Dados vindos do Instagram</h2>
          <p>
            Se o atendimento tiver sido iniciado pelo Instagram, informe também o
            nome de usuário utilizado na conversa. Após a confirmação, os dados
            armazenados no CRM serão analisados e excluídos quando não houver
            obrigação legal ou outra base legítima que exija sua conservação.
          </p>

          <h2>Prazo e confirmação</h2>
          <p>
            A solicitação será tratada em prazo razoável, considerando a natureza
            do pedido e as obrigações legais aplicáveis. Quando necessário,
            entraremos em contato para confirmar a conclusão ou pedir informações
            adicionais.
          </p>

          <Link className="admin-link-button" to="/politica-de-privacidade">
            Voltar para a Política de Privacidade
          </Link>
        </article>
      </section>
    </main>
  );
}
