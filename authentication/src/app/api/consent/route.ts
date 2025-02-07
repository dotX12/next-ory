import {NextRequest, NextResponse} from 'next/server';
import {getOAuth2Api} from '@/ory/sdk/server';
import {ConsentRequest, isConsentRequest} from "@/models/consentRequest";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    if (req.method !== 'POST') {
        return NextResponse.json(
            {error: 'Invalid request method'},
            {status: 405}
        );
    }
    try {
        const json = await req.json();

        if (!isConsentRequest(json)) {
            return NextResponse.json(
                {error: 'Invalid request payload'},
                {status: 400}
            );
        }

        const data: ConsentRequest = json;
        const hydra = await getOAuth2Api();

        if (data.action === 'accept') {
            const response = await hydra.acceptOAuth2ConsentRequest({
                consentChallenge: data.consentChallenge,
                acceptOAuth2ConsentRequest: {
                    grant_scope: data.scopes,
                    remember: data.remember,
                    remember_for: 36000,
                },
            });

            if (!response.data.redirect_to) {
                console.error('Missing redirect_to in Hydra response');
                return NextResponse.json(
                    {error: 'Invalid redirect URL'},
                    {status: 500}
                );
            }

            return NextResponse.json({redirect_to: response.data.redirect_to});
        } else if (data.action === 'reject') {
            const response = await hydra.rejectOAuth2ConsentRequest({
                consentChallenge: String(data.consentChallenge),
                rejectOAuth2Request: {
                    error: 'access_denied',
                    error_description: 'The resource owner denied the request',
                },
            });

            return NextResponse.json({redirect_to: response.data.redirect_to});
        }
    } catch (error) {
        console.error('Error processing consent request:', error);
        return NextResponse.json(
            {error: 'Something unexpected went wrong.'},
            {status: 500}
        );
    }
}