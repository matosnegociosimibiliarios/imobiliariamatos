import React, { useEffect, useRef, useState } from 'react';
import { completeWhatsAppEmbeddedSignup, getWhatsAppMetaConfig } from '../services/meta';

function loadFacebookSdk(appId) {
  return new Promise((resolve, reject) => {
    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v26.0',
      });
      resolve(window.FB);
      return;
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v26.0',
      });
      resolve(window.FB);
    };

    if (document.getElementById('facebook-jssdk')) return;

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Meta.'));
    document.body.appendChild(script);
  });
}

export default function WhatsAppEmbeddedSignup({ onConnected }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState('');
  const sessionRef = useRef({ wabaId: null, phoneNumberId: null, displayPhoneNumber: null });

  useEffect(() => {
    let active = true;

    getWhatsAppMetaConfig()
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const listener = (event) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;

      let data = event.data;
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch {
        return;
      }

      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      const payload = data.data || {};
      if (payload.waba_id) sessionRef.current.wabaId = payload.waba_id;
      if (payload.phone_number_id) sessionRef.current.phoneNumberId = payload.phone_number_id;
      if (payload.display_phone_number) sessionRef.current.displayPhoneNumber = payload.display_phone_number;

      if (data.event === 'ERROR') {
        setConnecting(false);
        setMessage(payload.error_message || 'A Meta informou um erro no cadastro.');
      }

      if (data.event === 'CANCEL') {
        setConnecting(false);
        setMessage('Conexão cancelada na Meta.');
      }
    };

    window.addEventListener('message', listener);
    return () => {
      active = false;
      window.removeEventListener('message', listener);
    };
  }, []);

  async function handleConnect() {
    setMessage('');
    setConnecting(true);

    if (!config?.config_id) {
      setConnecting(false);
      setMessage('A configuração Embedded Signup ainda não foi cadastrada na Meta.');
      return;
    }

    try {
      const FB = await loadFacebookSdk(config.app_id);
      FB.login(async (response) => {
        const code = response?.authResponse?.code;

        if (!code) {
          setConnecting(false);
          setMessage('A Meta não retornou o código de autorização. Tente novamente.');
          return;
        }

        try {
          const result = await completeWhatsAppEmbeddedSignup({
            code,
            wabaId: sessionRef.current.wabaId,
            phoneNumberId: sessionRef.current.phoneNumberId,
            displayPhoneNumber: sessionRef.current.displayPhoneNumber,
            sessionEvent: sessionRef.current.wabaId ? 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' : null,
          });

          setConnecting(false);
          setMessage(
            result.coexistence
              ? 'WhatsApp conectado em coexistência com o aplicativo WhatsApp Business.'
              : 'WhatsApp Business conectado ao CRM.'
          );
          onConnected?.(result);
        } catch (error) {
          setConnecting(false);
          setMessage(error.message);
        }
      }, {
        config_id: config.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      });
    } catch (error) {
      setConnecting(false);
      setMessage(error.message);
    }
  }

  if (loading) return <div className="integration-note">Preparando conexão com a Meta...</div>;

  return (
    <div className="whatsapp-connect-box">
      <div>
        <strong>Conectar WhatsApp Business ao CRM</strong>
        <p>
          Abre o cadastro oficial da Meta. O número atual do WhatsApp Business pode ser conectado em coexistência, sem removê-lo do aplicativo.
        </p>
      </div>
      <button type="button" className="button" onClick={handleConnect} disabled={connecting || !config?.config_id}>
        {connecting ? 'Aguardando a Meta...' : 'Conectar WhatsApp Business'}
      </button>
      {!config?.config_id && (
        <small className="integration-note">
          Falta somente o Configuration ID do Embedded Signup da Meta.
        </small>
      )}
      {message && <div className="integration-note">{message}</div>}
    </div>
  );
}
