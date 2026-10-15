import { request } from '.';
import { AxiosRequestConfig } from 'axios';

interface CreateAuthorizationCodeData {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  token: string;
}

interface CreateAuthorizationCodeResponse {
  code: string;
}

const createAuthorizationCode = ({
  data,
  configs,
}: {
  data: CreateAuthorizationCodeData;
  configs?: AxiosRequestConfig;
}) => {
  return request<CreateAuthorizationCodeResponse>({
    method: 'POST',
    url: `${window.location.origin}/bot-auth/v1/bot-authorization/codes`,
    data: {
      client_id: data.clientId,
      redirect_uri: data.redirectUri,
      code_challenge: data.codeChallenge,
    },
    ...configs,
    headers: {
      ...configs?.headers,
      Authorization: `Bearer ${data.token}`,
    },
  });
};

export default { createAuthorizationCode };
