import React, { useEffect, useState } from 'react';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallGoiButton() {
  const [installPrompt, setInstallPrompt] = useState(() => window.__goiInstallPrompt || null);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && isStandalone());

  useEffect(() => {
    function syncPrompt() {
      setInstallPrompt(window.__goiInstallPrompt || null);
    }

    function handleInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    syncPrompt();
    window.addEventListener('goi-install-ready', syncPrompt);
    window.addEventListener('goi-installed', handleInstalled);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('goi-install-ready', syncPrompt);
      window.removeEventListener('goi-installed', handleInstalled);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (installed || isStandalone()) {
      setInstalled(true);
      return;
    }

    const promptEvent = installPrompt || window.__goiInstallPrompt;
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice?.outcome === 'accepted') setInstalled(true);
      window.__goiInstallPrompt = null;
      setInstallPrompt(null);
      return;
    }

    if (isIos()) {
      window.alert('Para instalar o GOI no iPhone/iPad: toque em Compartilhar no Safari e depois em “Adicionar à Tela de Início”.');
      return;
    }

    window.alert('O navegador ainda não liberou o instalador. Atualize esta página uma vez e clique novamente em “Instalar GOI”.');
  }

  if (installed) return null;

  return (
    <button type="button" className="admin-install-goi" onClick={install}>
      <span>Instalar GOI</span>
      <small>{installPrompt ? 'Instalar agora' : 'Celular ou computador'}</small>
    </button>
  );
}
