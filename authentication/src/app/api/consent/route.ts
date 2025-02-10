import {NextRequest, NextResponse} from 'next/server';
import {getFrontendApi, getOAuth2Api} from '@/ory/sdk/server';
import {AcceptConsentRequest, ConsentRequest, isConsentRequest, RejectConsentRequest} from "@/models/consentRequest";
import {FrontendApi, OAuth2ConsentRequest} from "@ory/client";
import {extractSession} from "@/ory";
import {OAuth2Api} from "@ory/client/dist/api";

export const dynamic = 'force-dynamic';


async function validateRequestPayload(req: NextRequest): Promise<ConsentRequest | NextResponse> {
    try {
        const json = await req.json();
        if (!isConsentRequest(json)) {
            return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
        }
        return json as ConsentRequest;
    } catch (error) {
        console.error('failed parse json:', error);
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
}

async function fetchConsentRequest(
    consentChallenge: string,
    hydra: OAuth2Api,
): Promise<OAuth2ConsentRequest | NextResponse> {
    try {
        const response = await hydra.getOAuth2ConsentRequest({ consentChallenge });
        return response.data;
    } catch (error) {
        console.error('Failed to fetch consent request', error);
        return NextResponse.json({ error: 'Error processing consent challenge' });
    }
}

async function getUserSession(
    cookies: NextRequest['cookies'],
    frontend: FrontendApi,
): Promise<any | NextResponse> {
    const oryKratosSession = cookies.get("ory_kratos_session")?.value;
    try {
        const sessionResponse = await frontend.toSession({
            cookie: `ory_kratos_session=${oryKratosSession}`,
        });
        return sessionResponse.data;
    } catch (error) {
        console.error('Failed to fetch user session', error);
        return NextResponse.json({ error: 'User session could not be retrieved' }, { status: 500 });
    }
}

async function handleAcceptConsent(
    data: AcceptConsentRequest,
    consent: OAuth2ConsentRequest,
    session: any,
    hydra: OAuth2Api,
): Promise<NextResponse> {
    try {
        const acceptResponse = await hydra.acceptOAuth2ConsentRequest({
            consentChallenge: data.consentChallenge,
            acceptOAuth2ConsentRequest: {
                grant_scope: data.scopes,
                remember: data.remember,
                grant_access_token_audience: consent.requested_access_token_audience,
                session: extractSession(session.identity, data.scopes),
            },
        });

        if (!acceptResponse.data.redirect_to) {
            console.error('Missing redirect_to in Hydra response');
            return NextResponse.json({ error: 'Invalid redirect URL' }, { status: 500 });
        }

        return NextResponse.json({ redirect_to: acceptResponse.data.redirect_to });
    } catch (error) {
        console.error('Error accepting consent request', error);
        return NextResponse.json({ error: 'Error accepting consent' }, { status: 500 });
    }
}

async function handleRejectConsent(
    data: RejectConsentRequest,
    hydra: OAuth2Api,
): Promise<NextResponse> {
    try {
        const rejectResponse = await hydra.rejectOAuth2ConsentRequest({
            consentChallenge: String(data.consentChallenge),
            rejectOAuth2Request: {
                error: 'access_denied',
                error_description: 'The resource owner denied the request',
            },
        });
        return NextResponse.json({ redirect_to: rejectResponse.data.redirect_to });
    } catch (error) {
        console.error('Error rejecting consent request', error);
        return NextResponse.json({ error: 'Error rejecting consent' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json({ error: 'Invalid request method' }, { status: 405 });
    }

    try {
        const requestData = await validateRequestPayload(req);
        if (requestData instanceof NextResponse) {
            return requestData;
        }
        const data = requestData;

        const hydra = await getOAuth2Api();
        const frontend = await getFrontendApi();

        const consent = await fetchConsentRequest(data.consentChallenge, hydra);
        if (consent instanceof NextResponse) {
            return consent;
        }

        const session = await getUserSession(req.cookies, frontend);
        if (session instanceof NextResponse) {
            return session;
        }

        if (data.action === 'accept') {
            return await handleAcceptConsent(data, consent, session, hydra);
        } else if (data.action === 'reject') {
            return await handleRejectConsent(data, hydra);
        } else {
            return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error processing consent request:', error);
        return NextResponse.json(
            { error: 'Something unexpected went wrong.' },
            { status: 500 }
        );
    }
}