import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';

import Home from './pages/Home';
import Comprar from './pages/Comprar';
import Alugar from './pages/Alugar';
import Imovel from './pages/Imovel';
import OwnerCapture from './pages/OwnerCapture';
import LocalProperties from './pages/LocalProperties';
import NotFound from './pages/NotFound';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';

import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';
import AdminLeads from './pages/admin/AdminLeads';
import AdminAppointments from './pages/admin/AdminAppointments';
import AdminLeadDetail from './pages/admin/AdminLeadDetail';
import AdminActions from './pages/admin/AdminActions';
import AdminCaptures from './pages/admin/AdminCaptures';
import AdminCaptureDetail from './pages/admin/AdminCaptureDetail';
import AdminIntegrations from './pages/admin/AdminIntegrations';
import AdminInstagramInbox from './pages/admin/AdminInstagramInbox';
import AdminWhatsAppInbox from './pages/admin/AdminWhatsAppInbox';
import AdminProposals from './pages/admin/AdminProposals';
import AdminProposalForm from './pages/admin/AdminProposalForm';
import AdminDeals from './pages/admin/AdminDeals';
import AdminDealDetail from './pages/admin/AdminDealDetail';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/comprar" element={<Comprar />} />
        <Route path="/alugar" element={<Alugar />} />
        <Route path="/imovel/:slug" element={<Imovel />} />
        <Route
          path="/anuncie-seu-imovel"
          element={<OwnerCapture requestType="listing" />}
        />
        <Route
          path="/avaliacao-do-imovel"
          element={<OwnerCapture requestType="valuation" />}
        />
        <Route path="/imoveis-a-venda/:citySlug" element={<LocalProperties purpose="sale" />} />
        <Route path="/imoveis-a-venda/:citySlug/:typeSlug" element={<LocalProperties purpose="sale" />} />
        <Route path="/imoveis-para-alugar/:citySlug" element={<LocalProperties purpose="rent" />} />
        <Route path="/imoveis-para-alugar/:citySlug/:typeSlug" element={<LocalProperties purpose="rent" />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
        <Route path="/exclusao-de-dados" element={<DataDeletion />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/imoveis" element={<AdminProperties />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
          <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
          <Route path="/admin/acoes" element={<AdminActions />} />
          <Route path="/admin/propostas" element={<AdminProposals />} />
          <Route path="/admin/propostas/nova" element={<AdminProposalForm />} />
          <Route path="/admin/propostas/:id" element={<AdminProposalForm />} />
          <Route path="/admin/negocios" element={<AdminDeals />} />
          <Route path="/admin/negocios/:id" element={<AdminDealDetail />} />
          <Route path="/admin/agendamentos" element={<AdminAppointments />} />
          <Route path="/admin/captacoes" element={<AdminCaptures />} />
          <Route path="/admin/captacoes/:id" element={<AdminCaptureDetail />} />
          <Route path="/admin/integracoes" element={<AdminIntegrations />} />
          <Route path="/admin/mensagens" element={<AdminInstagramInbox />} />
          <Route path="/admin/whatsapp" element={<AdminWhatsAppInbox />} />
          <Route path="/admin/imoveis/novo" element={<AdminPropertyForm />} />
          <Route path="/admin/imoveis/:id/editar" element={<AdminPropertyForm />} />
        </Route>
      </Route>
    </Routes>
  );
}
