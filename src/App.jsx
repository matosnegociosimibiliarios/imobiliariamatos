import React from 'react';
import { Routes, Route } from 'react-router-dom';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import Comprar from './pages/Comprar';
import Alugar from './pages/Alugar';

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/comprar" element={<Comprar />} />
        <Route path="/alugar" element={<Alugar />} />
      </Route>
    </Routes>
  );
}
