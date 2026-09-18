import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import PermissionRoute from './components/PermissionRoute';

import Home from './pages/Home';
import Comprar from './pages/Comprar';
import Alugar from './pages/Alugar';
import Imovel from './pages/Imovel';
import OwnerCapture from './pages/OwnerCapture';
import LocalProperties from './pages/LocalProperties';
import NotFound from './pages/NotFound';
import PrivacyPolicy from './pages/PrivacyPolicy';
import DataDeletion from './pages/DataDeletion';
import AcceptInvite from './pages/AcceptInvite';

import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';
import AdminPropertyManagement from './pages/admin/AdminPropertyManagement';
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
import AdminDocuments from './pages/admin/AdminDocuments';
import AdminManagement from './pages/admin/AdminManagement';
import AdminReports from './pages/admin/AdminReports';
import AdminHealth from './pages/admin/AdminHealth';
import AdminTeam from './pages/admin/AdminTeam';
import AdminRentals from './pages/admin/AdminRentals';
import AdminRentalForm from './pages/admin/AdminRentalForm';
import AdminRentalDetail from './pages/admin/AdminRentalDetail';
import AdminFinance from './pages/admin/AdminFinance';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/comprar" element={<Comprar />} />
        <Route path="/alugar" element={<Alugar />} />
        <Route path="/imovel/:slug" element={<Imovel />} />
        <Route path="/anuncie-seu-imovel" element={<OwnerCapture requestType="listing" />} />
        <Route path="/avaliacao-do-imovel" element={<OwnerCapture requestType="valuation" />} />
        <Route path="/imoveis-a-venda/:citySlug" element={<LocalProperties purpose="sale" />} />
        <Route path="/imoveis-a-venda/:citySlug/:typeSlug" element={<LocalProperties purpose="sale" />} />
        <Route path="/imoveis-para-alugar/:citySlug" element={<LocalProperties purpose="rent" />} />
        <Route path="/imoveis-para-alugar/:citySlug/:typeSlug" element={<LocalProperties purpose="rent" />} />
        <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
        <Route path="/exclusao-de-dados" element={<DataDeletion />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/convite" element={<AcceptInvite />} />

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<PermissionRoute permission="dashboard.view"><AdminDashboard /></PermissionRoute>} />
          <Route path="/admin/imoveis" element={<PermissionRoute permission="properties.view"><AdminProperties /></PermissionRoute>} />
          <Route path="/admin/leads" element={<PermissionRoute permission="leads.view"><AdminLeads /></PermissionRoute>} />
          <Route path="/admin/leads/:id" element={<PermissionRoute permission="leads.view"><AdminLeadDetail /></PermissionRoute>} />
          <Route path="/admin/acoes" element={<PermissionRoute permission="leads.view"><AdminActions /></PermissionRoute>} />
          <Route path="/admin/propostas" element={<PermissionRoute permission="proposals.view"><AdminProposals /></PermissionRoute>} />
          <Route path="/admin/propostas/nova" element={<PermissionRoute permission="proposals.manage"><AdminProposalForm /></PermissionRoute>} />
          <Route path="/admin/propostas/:id" element={<PermissionRoute permission="proposals.view"><AdminProposalForm /></PermissionRoute>} />
          <Route path="/admin/negocios" element={<PermissionRoute permission="deals.view"><AdminDeals /></PermissionRoute>} />
          <Route path="/admin/negocios/:id" element={<PermissionRoute permission="deals.view"><AdminDealDetail /></PermissionRoute>} />
          <Route path="/admin/documentos" element={<PermissionRoute permission="documents.view"><AdminDocuments /></PermissionRoute>} />
          <Route path="/admin/gestao" element={<PermissionRoute permission="management.view"><AdminManagement /></PermissionRoute>} />
          <Route path="/admin/relatorios" element={<PermissionRoute permission="reports.view"><AdminReports /></PermissionRoute>} />
          <Route path="/admin/saude" element={<PermissionRoute permission="health.view"><AdminHealth /></PermissionRoute>} />
          <Route path="/admin/agendamentos" element={<PermissionRoute permission="appointments.view"><AdminAppointments /></PermissionRoute>} />
          <Route path="/admin/captacoes" element={<PermissionRoute permission="captures.view"><AdminCaptures /></PermissionRoute>} />
          <Route path="/admin/captacoes/:id" element={<PermissionRoute permission="captures.view"><AdminCaptureDetail /></PermissionRoute>} />
          <Route path="/admin/equipe" element={<PermissionRoute permission="team.view"><AdminTeam /></PermissionRoute>} />
          <Route path="/admin/integracoes" element={<PermissionRoute permission="integrations.manage"><AdminIntegrations /></PermissionRoute>} />
          <Route path="/admin/mensagens" element={<PermissionRoute permission="messages.view"><AdminInstagramInbox /></PermissionRoute>} />
          <Route path="/admin/whatsapp" element={<PermissionRoute permission="messages.view"><AdminWhatsAppInbox /></PermissionRoute>} />
          <Route path="/admin/imoveis/novo" element={<PermissionRoute permission="properties.manage"><AdminPropertyForm /></PermissionRoute>} />
          <Route path="/admin/imoveis/:id/editar" element={<PermissionRoute permission="properties.manage"><AdminPropertyForm /></PermissionRoute>} />
          <Route path="/admin/imoveis/:id/gestao" element={<PermissionRoute permission="properties.view"><AdminPropertyManagement /></PermissionRoute>} />
          <Route path="/admin/locacoes" element={<PermissionRoute permission="rentals.view"><AdminRentals /></PermissionRoute>} />
          <Route path="/admin/locacoes/nova" element={<PermissionRoute permission="rentals.manage"><AdminRentalForm /></PermissionRoute>} />
          <Route path="/admin/locacoes/:id" element={<PermissionRoute permission="rentals.view"><AdminRentalDetail /></PermissionRoute>} />
          <Route path="/admin/locacoes/:id/editar" element={<PermissionRoute permission="rentals.manage"><AdminRentalForm /></PermissionRoute>} />
          <Route path="/admin/financeiro" element={<PermissionRoute permission="financial.view"><AdminFinance /></PermissionRoute>} />
        </Route>
      </Route>
    </Routes>
  );
}
