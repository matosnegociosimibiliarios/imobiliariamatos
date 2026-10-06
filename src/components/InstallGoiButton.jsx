import React, { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallGoiButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (installed || isStandalone()) {
      setInstalled(true);
      return;
    }

    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
      setInstallPrompt(null);
      return;
    }

    if (isIos()) {
      window.alert('Para instalar o GOI no iPhone/iPad: toque em Compartilhar no Safari e depois em “Adicionar à Tela de Início”.');
      return;
    }

    window.alert('No seu navegador, abra o menu e escolha “Instalar GOI” ou “Instalar aplicativo”. O GOI será instalado diretamente, sem Play Store ou App Store.');
  }

  if (installed) return null;

  return (
    <button type="button" className="admin-install-goi" onClick={install}>
      <span>Instalar GOI</span>
      <small>Celular ou computador</small>
    </button>
  );
}
