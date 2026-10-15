import { Alert, Spin } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { Redirect, useLocation } from 'react-router-dom';
import { api } from '@/apis';
import { AppState } from '@/store';
import { useSelector } from 'react-redux';
import { routes } from './routes';

const getRequiredParameter = (params: URLSearchParams, name: string) => {
  const value = params.get(name);
  return value && value.trim() ? value : null;
};

const BotAuthorize: React.FC = () => {
  const location = useLocation();
  const token = useSelector((state: AppState) => state.user.token);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const clientId = getRequiredParameter(query, 'client_id');
  const redirectUri = getRequiredParameter(query, 'redirect_uri');
  const state = getRequiredParameter(query, 'state');
  const codeChallenge = getRequiredParameter(query, 'code_challenge');

  useEffect(() => {
    if (!token || !clientId || !redirectUri || !state || !codeChallenge) {
      return;
    }

    api.botAuthorization
      .createAuthorizationCode({
        data: { clientId, redirectUri, codeChallenge, token },
      })
      .then(({ data }) => {
        const callback = new URL(redirectUri);
        callback.searchParams.set('code', data.code);
        callback.searchParams.set('state', state);
        window.location.assign(callback.toString());
      })
      .catch((result) => {
        const detail = result?.data?.message;
        setError(
          `无法完成 Bot 授权：${
            typeof detail === 'string' ? detail : JSON.stringify(detail ?? '')
          }`,
        );
      });
  }, [clientId, codeChallenge, redirectUri, state, token]);

  if (!clientId || !redirectUri || !state || !codeChallenge) {
    return <Alert type="error" message="无效的 Bot 授权请求。" showIcon />;
  }
  if (!token) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Redirect
        to={`${routes.login}?return_to=${encodeURIComponent(returnTo)}`}
      />
    );
  }
  if (error) {
    return <Alert type="error" message={error} showIcon />;
  }
  return <Spin tip="正在授权 Bot 访问..." />;
};

export default BotAuthorize;
