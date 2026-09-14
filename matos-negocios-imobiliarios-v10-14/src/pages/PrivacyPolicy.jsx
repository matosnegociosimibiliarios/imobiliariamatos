import React from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';

export default function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <SeoHead
        title="Política de Privacidade"
        description="Política de Privacidade da Matos Negócios Imobiliários."
        canonicalPath="/politica-de-privacidade"
      />

      <section className="legal-hero">
        <span className="eyebrow">Privacidade</span>
        <h1>Política de Privacidade</h1>
        <p>
          Esta política explica como a Matos Negócios Imobiliários trata dados
          pessoais recebidos pelo site, formulários e integrações autorizadas.
        </p>
      </section>

      <section className="section legal-content">
        <article>
          <h2>1. Quem somos</h2>
          <p>
            A Matos Negócios Imobiliários utiliza este site para divulgar imóveis,
            receber contatos de interessados, captar imóveis de proprietários,
            organizar agendamentos e acompanhar atendimentos em seu CRM.
          </p>

          <h2>2. Quais dados podem ser coletados</h2>
          <p>
            Podemos receber dados informados diretamente pelo usuário, como nome,
            telefone, WhatsApp, e-mail, mensagem, imóvel de interesse, solicitação
            de visita e informações enviadas por proprietários que desejam anunciar
            ou avaliar um imóvel.
          </p>
          <p>
            Também podemos registrar informações técnicas e de navegação, como
            páginas visitadas, origem do acesso, campanha, cliques em botões,
            identificador anônimo de sessão e interações necessárias para medir o
            desempenho do site.
          </p>

          <h2>3. Instagram e Meta</h2>
          <p>
            Quando o usuário inicia uma conversa com o perfil profissional da
            Matos Negócios Imobiliários no Instagram e autoriza ou utiliza recursos
            disponibilizados pela Meta, podemos receber dados da interação por meio
            das APIs oficiais da Meta para organizar o atendimento no CRM.
          </p>
          <p>
            Esses dados podem incluir identificadores fornecidos pela plataforma,
            nome de perfil, conteúdo da mensagem e informações necessárias para
            manter o histórico do atendimento. O uso dessas informações é limitado
            à finalidade de atendimento imobiliário e relacionamento com o cliente.
          </p>

          <h2>4. Para que usamos os dados</h2>
          <p>
            Os dados são usados para responder contatos, identificar imóveis de
            interesse, organizar visitas, acompanhar negociações, atender
            proprietários, medir a origem dos contatos, melhorar o site e cumprir
            obrigações legais ou regulatórias aplicáveis.
          </p>

          <h2>5. Compartilhamento</h2>
          <p>
            Não vendemos dados pessoais. Informações podem ser processadas por
            fornecedores de infraestrutura e plataformas necessárias ao
            funcionamento do serviço, como hospedagem, banco de dados e APIs de
            comunicação, sempre de acordo com suas respectivas políticas e com as
            finalidades desta operação.
          </p>

          <h2>6. Segurança e armazenamento</h2>
          <p>
            São adotadas medidas técnicas e administrativas compatíveis com o porte
            do serviço para reduzir riscos de acesso indevido, alteração, perda ou
            divulgação não autorizada. O acesso administrativo ao CRM é protegido
            por autenticação e regras de acesso no banco de dados.
          </p>

          <h2>7. Direitos do titular</h2>
          <p>
            Nos termos da legislação aplicável, inclusive a Lei Geral de Proteção
            de Dados Pessoais (LGPD), o titular pode solicitar informações sobre o
            tratamento de seus dados, correção, exclusão quando aplicável,
            revogação de consentimento e outras providências previstas em lei.
          </p>

          <h2>8. Exclusão de dados</h2>
          <p>
            Para instruções sobre solicitação de exclusão, consulte a página
            específica abaixo.
          </p>

          <Link className="admin-link-button" to="/exclusao-de-dados">
            Ver instruções para exclusão de dados
          </Link>

          <h2>9. Contato</h2>
          <p>
            Solicitações relacionadas à privacidade podem ser feitas pelos canais
            oficiais de contato da Matos Negócios Imobiliários divulgados neste
            site e no perfil profissional da empresa.
          </p>

          <h2>10. Atualizações desta política</h2>
          <p>
            Esta política poderá ser atualizada para refletir mudanças no site,
            nas integrações ou nas exigências legais e das plataformas utilizadas.
          </p>

          <p className="legal-updated">
            Última atualização: 13 de setembro de 2026.
          </p>
        </article>
      </section>
    </main>
  );
}
