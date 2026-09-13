import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';

import Home from './pages/Home';
import Comprar from './pages/Comprar';
import Alugar from './pages/Alugar';
import Imovel from './pages/Imovel';

import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/comprar" element={<Comprar />} />
        <Route path="/alugar" element={<Alugar />} />
        <Route path="/imovel/:slug" element={<Imovel />} />
      </Route>

      <Route path="/login" element={<Login />} />

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/imoveis" element={<AdminProperties />} />
          <Route path="/admin/imoveis/novo" element={<AdminPropertyForm />} />
          <Route path="/admin/imoveis/:id/editar" element={<AdminPropertyForm />} />
        </Route>
      </Route>
    </Routes>
  );
}
