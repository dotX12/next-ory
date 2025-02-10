import React from 'react'
import {Card} from '@/components/ui/card'
import {OAuth2ConsentRequest} from '@ory/client'
import ConsentForm from '@/components/consentForm'
import {getFrontendApi, getOAuth2Api} from '@/ory/sdk/server'
import {redirect} from 'next/navigation'
import {extractSession, shouldSkipConsent} from "@/ory";
import {cookies} from "next/headers";

export const dynamic = 'force-dynamic';

interface ConsentPageProps {
    consent_challenge: string,
}

export default async function ConsentPage(props: {
    searchParams: Promise<ConsentPageProps>
}) {
    const serviceSearchParams = await props.searchParams;
    console.debug("serviceSearchParams: ", serviceSearchParams);

    const challenge = String(serviceSearchParams.consent_challenge);
    console.debug("consentChallenge: ", challenge);

    if (!challenge) {
        return <div>Invalid consent challenge</div>
    }

    let hydra
    let frontend

    try {
        hydra = await getOAuth2Api()
    } catch (error) {
        console.error('Could not init Hydra', error)
        return <div>Could not init Hydra</div>
    }
    try {
        frontend = await getFrontendApi()
    } catch (error) {
        console.error('Could not init Frontend', error)
        return <div>Could not init Frontend</div>
    }

    let consent: OAuth2ConsentRequest
    try {
        const consentResponse = await hydra.getOAuth2ConsentRequest(
            {consentChallenge: challenge},
        )
        consent = consentResponse.data
    } catch (error) {
        console.error('Failed to fetch consent request', error)
        return <div>Error processing consent challenge</div>
    }

    // If a user has granted this application the requested scope, hydra will tell us to not show the UI.
    if (shouldSkipConsent(consent)) {
        console.debug("shouldSkipConsent: ", consent)

        let grantScope = consent.requested_scope || [];

        let h = await cookies()
        let oryKratosSession = h.get("ory_kratos_session")?.value
        console.debug("ory_kratos_session: ", oryKratosSession);

        const sessionResponse = (
            await frontend.toSession({
                cookie: `ory_kratos_session=${oryKratosSession}`,
            })
        ).data;

        const acceptedSession = (
            await hydra.acceptOAuth2ConsentRequest({
                consentChallenge: challenge,
                acceptOAuth2ConsentRequest: {
                    // We can grant all scopes that have been requested - hydra already checked for us that no additional scopes
                    // are requested accidentally.
                    grant_scope: grantScope,

                    // ORY Hydra checks if requested audiences are allowed by the client, so we can simply echo this.
                    grant_access_token_audience:
                    consent.requested_access_token_audience,

                    // The session allows us to set session data for id and access tokens
                    session: extractSession(sessionResponse.identity, grantScope),
                },
            })
        ).data;
        redirect(acceptedSession.redirect_to);
    }
    return (
        <Card className="flex flex-col items-center w-full max-w-sm p-4">
            <ConsentForm
                request={consent}
                consentChallenge={challenge}
            />
        </Card>
    )

}