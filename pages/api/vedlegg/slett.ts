import { getCommaSeparatedStringFromStringOrArray } from '@navikt/aap-felles-utils-client';
import {
  logger,
  isMock,
  tokenXApiProxy,
  beskyttetApi,
  getAccessTokenFromRequest,
  getTokenX,
} from '@navikt/aap-felles-utils';
import metrics from 'lib/metrics';
import { proxyApiRouteRequest } from '@navikt/next-api-proxy';
import { NextApiRequest, NextApiResponse } from 'next';

const handler = beskyttetApi(async (req, res) => {
  const uuids = req.query.uuid ?? [];
  if (!uuids) {
    res.status(400).json({ error: 'uuid må være en string' });
  }
  const accessToken = getAccessTokenFromRequest(req);
  if (process.env.NY_INNSENDING === 'enabled') {
    // @ts-ignore-line TODO: Feil med type for NextApiResponse vi henter fra felleslib
    return await slettVedleggInnsending(uuids as string, accessToken!, req, res);
  }
  await slettVedlegg(uuids, accessToken);
  res.status(204).json({});
});

export const slettVedleggInnsending = async (
  uuid: string,
  accessToken: string,
  req: NextApiRequest,
  res: NextApiResponse
) => {
  if (isMock()) return;

  let tokenXToken;
  try {
    tokenXToken = await getTokenX(accessToken, process.env.INNSENDING_AUDIENCE!);
  } catch (error) {
    logger.error('Kunne ikke hente tokenXToken', error);
    throw error;
  }

  return await proxyApiRouteRequest({
    hostname: 'innsending',
    path: `/mellomlarging/fil/${uuid}`,
    req: req,
    res: res,
    bearerToken: tokenXToken,
    https: false,
  });
};

export const slettVedlegg = async (uuids: string | string[], accessToken?: string) => {
  if (isMock()) return;
  const commaSeparatedUuids = getCommaSeparatedStringFromStringOrArray(uuids);
  await tokenXApiProxy({
    url: `${process.env.SOKNAD_API_URL}/vedlegg/slett?uuids=${commaSeparatedUuids}`,
    prometheusPath: '/vedlegg/slett',
    method: 'DELETE',
    noResponse: true,
    audience: process.env.SOKNAD_API_AUDIENCE!,
    bearerToken: accessToken,
    logger: logger,
    metricsStatusCodeCounter: metrics.backendApiStatusCodeCounter,
    metricsTimer: metrics.backendApiDurationHistogram,
  });
};

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default handler;
