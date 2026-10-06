import React from 'react';
import { Link } from 'react-router-dom';
import SeoHead from '../components/SeoHead';

const features = [
  ['Clientes e Leads','Centralize contatos, origens, próximos passos e histórico de atendimento.'],
  ['Funil Comercial','Acompanhe cada oportunidade da entrada do lead até o negócio fechado.'],
  ['Imóveis e Captações','Organize carteira, proprietários, fotos, vídeos e andamento de cada captação.'],
  ['Propostas e Negócios','Controle propostas, negociações, comissões e vendas concluídas.'],
  ['Locação','Acompanhe interessados, visitas, processos, contratos, cobranças e manutenção.'],
  ['Financeiro','Tenha visão das receitas, despesas, lançamentos e operação financeira da imobiliária.'],
  ['WhatsApp e Instagram','Centralize integrações e mensagens dentro da operação comercial.'],
  ['Equipe e Permissões','Organize usuários, funções e acessos por responsabilidade.'],
  ['Site da Imobiliária','Publique imóveis em um site conectado ao GOI e receba leads direto no sistema.'],
  ['Agenda e Tarefas','Não deixe retornos, visitas e compromissos importantes se perderem.'],
  ['Relatórios e Gestão','Acompanhe indicadores para tomar decisões com mais clareza.'],
  ['Multi-imobiliária','Cada imobiliária usa seu próprio ambiente, com dados e configurações separados.'],
];

const faqItems = [
  ['Preciso instalar alguma coisa?','Não é obrigatório. O GOI funciona pelo navegador e também pode ser instalado diretamente no celular ou computador, sem Play Store ou App Store.'],
  ['O teste realmente é gratuito?','Sim. A imobiliária pode testar o sistema por 14 dias antes de contratar um plano.'],
  ['Posso cadastrar minha equipe?','Sim. A quantidade de usuários depende do plano contratado e os acessos podem ser organizados por função e permissão.'],
  ['O site mostra a marca do GOI?','Não como marca principal. O site público utiliza a identidade da própria imobiliária, incluindo nome, logo e informações públicas configuradas por ela.'],
  ['O que acontece se meu acesso expirar?','O sistema pode bloquear o acesso comercial até a regularização, mas os dados da imobiliária não são apagados automaticamente por causa da expiração.'],
  ['Meus dados ficam misturados com os de outras imobiliárias?','Não. Cada imobiliária possui sua própria organização e o sistema aplica isolamento de dados por organização.'],
];

const plans = [
  {
    name:'Essencial', price:'R$ 49,90', users:'Até 2 usuários', properties:'Até 100 imóveis',
    items:['CRM comercial','Clientes e leads','Imóveis e captações','Propostas e negócios','Agenda e tarefas','Sem avaliador de imóveis'],
  },
  {
    name:'Profissional', price:'R$ 99,90', users:'Até 8 usuários', properties:'Até 500 imóveis', featured:true,
    items:['Tudo do Essencial','Avaliador rápido de imóveis','Financeiro','Locação','Integrações','Site imobiliário integrado'],
  },
  {
    name:'Empresarial', price:'R$ 199,90', users:'Usuários ilimitados', properties:'Imóveis ilimitados',
    items:['Todos os recursos','Avaliador rápido + avaliação completa','Estrutura para operação maior','Limites ampliados','Preparado para domínio personalizado'],
  },
];

export default function MatosCrmSales(){
  const seoDescription = 'Sistema de gestão para imobiliárias com CRM imobiliário, funil comercial, imóveis, captações, propostas, locação, financeiro, equipe e site integrado. Teste o GOI grátis por 14 dias.';
  const seoJsonLd = {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':'SoftwareApplication',
        name:'GOI — Gerenciador de Operações Imobiliárias',
        applicationCategory:'BusinessApplication',
        operatingSystem:'Web',
        description:seoDescription,
        url:`${window.location.origin}/goi`,
        image:`${window.location.origin}/goi-logo.svg`,
        offers: plans.map((plan)=>({
          '@type':'Offer',
          name:`Plano ${plan.name}`,
          priceCurrency:'BRL',
          price:plan.price.replace('R$ ','').replace(',','.'),
          url:`${window.location.origin}/cadastro`,
        })),
      },
      {
        '@type':'FAQPage',
        mainEntity:faqItems.map(([question,answer])=>({
          '@type':'Question',
          name:question,
          acceptedAnswer:{ '@type':'Answer', text:answer },
        })),
      },
    ],
  };

  return <main className="crm-sales">
    <SeoHead
      title="GOI | CRM e Sistema de Gestão para Imobiliárias"
      description={seoDescription}
      canonicalPath="/goi"
      siteName="GOI"
      image={`${window.location.origin}/goi-logo.svg`}
      jsonLd={seoJsonLd}
    />
    <header className="crm-sales-header">
      <Link className="crm-sales-brand" to="/goi">
        <img src="/goi-logo.svg" alt="GOI" />
        <div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div>
      </Link>
      <nav>
        <a href="#recursos">Recursos</a>
        <a href="#planos">Planos</a>
        <a href="#duvidas">Dúvidas</a>
      </nav>
      <div className="crm-sales-header-actions">
        <Link className="crm-sales-login" to="/login">Entrar</Link>
        <Link className="crm-sales-cta small" to="/cadastro">Teste grátis</Link>
      </div>
    </header>

    <section className="crm-sales-hero">
      <div className="crm-sales-hero-copy">
        <span className="crm-sales-kicker">Gerenciador de Operações Imobiliárias</span>
        <h1>Mais controle, mais previsibilidade e menos esforço para gerir sua imobiliária.</h1>
        <p>O GOI é um sistema de gestão para imobiliárias que reúne CRM imobiliário, imóveis, atendimento, equipe e operação em um só lugar para reduzir perdas, aumentar o controle e facilitar a gestão no dia a dia.</p>
        <div className="crm-sales-actions">
          <Link className="crm-sales-cta" to="/cadastro">Começar teste grátis por 14 dias</Link>
          <a className="crm-sales-secondary" href="#recursos">Conhecer recursos</a>
        </div>
        <div className="crm-sales-proof">
          <span>14 dias grátis</span><span>Sem pagamento inicial</span><span>Acesso pelo computador e celular</span>
        </div>
      </div>

      <div className="crm-sales-preview" aria-label="Prévia do painel GOI">
        <div className="crm-preview-top"><span></span><span></span><span></span><b>GOI</b></div>
        <div className="crm-preview-body">
          <aside>
            <strong>Início</strong>
            <span>Comercial</span>
            <span>Atendimento</span>
            <span>Locação</span>
            <span>Gestão</span>
            <span>Administração</span>
          </aside>
          <div className="crm-preview-content">
            <div className="crm-preview-heading"><div><small>SEU DIA NO GOI</small><h3>Início</h3></div><button>Rotina de hoje</button></div>
            <div className="crm-preview-panel">
              <small>CENTRO DE COMANDO</small>
              <h4>O que precisa de atenção hoje</h4>
              <div className="crm-preview-metrics">
                <div><span>Ações atrasadas</span><b>0</b></div>
                <div><span>Ações para hoje</span><b>3</b></div>
                <div><span>Visitas hoje</span><b>2</b></div>
                <div><span>Sem próxima ação</span><b>4</b></div>
              </div>
            </div>
            <div className="crm-preview-lower"><div></div><div></div><div></div></div>
          </div>
        </div>
      </div>
    </section>

    <section className="crm-sales-problems">
      <div className="crm-sales-section-heading">
        <span className="crm-sales-kicker">Menos improviso. Mais controle.</span>
        <h2>Quando a operação fica espalhada, oportunidades se perdem.</h2>
        <p>O GOI foi pensado para transformar uma operação espalhada e dependente de controles manuais em uma gestão mais organizada, previsível e fácil de acompanhar.</p>
      </div>
      <div className="crm-sales-problem-grid">
        {['Lead sem retorno','Imóvel perdido em planilha','Proposta esquecida','Corretor sem acompanhamento','Locação sem organização','Financeiro sem visão clara'].map((x,i)=><article key={x}><b>{String(i+1).padStart(2,'0')}</b><span>{x}</span></article>)}
      </div>
    </section>

    <section className="crm-sales-solution">
      <div>
        <span className="crm-sales-kicker light">Uma operação conectada</span>
        <h2>Do primeiro contato ao contrato, tudo no mesmo fluxo.</h2>
        <p>O lead chega pelo site, entra no GOI, passa pelo atendimento, funil, proposta, negócio e acompanhamento. A equipe trabalha com o mesmo histórico e a gestão enxerga o que está acontecendo.</p>
        <Link className="crm-sales-cta light" to="/cadastro">Criar minha imobiliária</Link>
      </div>
      <div className="crm-flow">
        {['Lead','Atendimento','Visita','Proposta','Negócio','Pós-venda'].map((x,i)=><React.Fragment key={x}><span>{x}</span>{i<5&&<i>→</i>}</React.Fragment>)}
      </div>
    </section>

    <section className="crm-sales-features" id="recursos">
      <div className="crm-sales-section-heading">
        <span className="crm-sales-kicker">Recursos</span>
        <h2>Uma plataforma feita para a rotina real de uma imobiliária.</h2>
      </div>
      <div className="crm-sales-feature-grid">
        {features.map(([title,desc])=><article key={title}><div className="crm-feature-icon">{title.charAt(0)}</div><h3>{title}</h3><p>{desc}</p></article>)}
      </div>
    </section>

    <section className="crm-sales-site-section">
      <div className="crm-sales-site-card">
        <div>
          <span className="crm-sales-kicker">GOI + site público</span>
          <h2>Seu site trabalha conectado ao seu atendimento.</h2>
          <p>A imobiliária pode usar sua própria marca no site público, publicar imóveis e receber interessados diretamente dentro do GOI.</p>
          <ul>
            <li>Identidade da própria imobiliária no site</li>
            <li>Imóveis publicados integrados ao GOI</li>
            <li>Formulários de compra, venda e locação</li>
            <li>Origem do lead registrada</li>
          </ul>
        </div>
        <div className="crm-site-mock">
          <div className="crm-site-browser"><i></i><i></i><i></i></div>
          <div className="crm-site-hero"><span>IMOBILIÁRIA</span><h3>Encontre o imóvel certo para você.</h3><button>Buscar imóveis</button></div>
          <div className="crm-site-cards"><div></div><div></div><div></div></div>
        </div>
      </div>
    </section>

    <section className="crm-sales-plans" id="planos">
      <div className="crm-sales-section-heading centered">
        <span className="crm-sales-kicker">Planos</span>
        <h2>Comece pequeno e evolua com a sua imobiliária.</h2>
        <p>Todos os planos têm teste gratuito por 14 dias.</p>
      </div>
      <div className="crm-sales-plan-grid">
        {plans.map(p=><article key={p.name} className={p.featured?'featured':''}>
          {p.featured&&<div className="crm-plan-badge">Mais completo para pequenas e médias</div>}
          <h3>{p.name}</h3><div className="crm-plan-price"><strong>{p.price}</strong><span>/mês</span></div>
          <p>{p.users}<br/>{p.properties}</p>
          <ul>{p.items.map(x=><li key={x}>{x}</li>)}</ul>
          <Link className="crm-sales-cta full" to="/cadastro">Testar grátis</Link>
        </article>)}
      </div>
      <p className="crm-sales-business-note">No plano Empresarial, a primeira mensalidade está prevista por R$ 149,90; depois R$ 199,90/mês.</p>
    </section>

    <section className="crm-sales-trial">
      <img src="/goi-logo.svg" alt="" />
      <div><span className="crm-sales-kicker light">Teste antes de decidir</span><h2>Use o GOI por 14 dias grátis.</h2><p>Cadastre sua imobiliária, conheça o sistema e veja se ele faz sentido para sua operação antes de assinar.</p></div>
      <Link className="crm-sales-cta light" to="/cadastro">Começar agora</Link>
    </section>

    <section className="crm-sales-faq" id="duvidas">
      <div className="crm-sales-section-heading"><span className="crm-sales-kicker">Dúvidas frequentes</span><h2>Antes de começar</h2></div>
      <div className="crm-sales-faq-grid">
        {faqItems.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </div>
    </section>

    <section className="crm-sales-final">
      <div><span className="crm-sales-kicker light">GOI</span><h2>Organize a operação antes que o crescimento vire desorganização.</h2><p>Comece agora e teste o sistema por 14 dias.</p></div>
      <Link className="crm-sales-cta light" to="/cadastro">Começar teste gratuito</Link>
    </section>

    <footer className="crm-sales-footer">
      <div className="crm-sales-brand"><img src="/goi-logo.svg" alt="GOI" /><div><strong>GOI</strong><small>Gerenciador de Operações Imobiliárias</small></div></div>
      <div><Link to="/login">Entrar</Link><Link to="/cadastro">Criar conta</Link></div>
      <p>© {new Date().getFullYear()} GOI — Gerenciador de Operações Imobiliárias.</p>
    </footer>
  </main>
}
