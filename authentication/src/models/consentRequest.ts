export type ConsentAction = 'accept' | 'reject';

export interface BaseConsentRequest {
    action: ConsentAction;
    consentChallenge: string;
}

export interface AcceptConsentRequest extends BaseConsentRequest {
    action: 'accept';
    scopes: string[];
    remember: boolean;
}

export interface RejectConsentRequest extends BaseConsentRequest {
    action: 'reject';
}

export type ConsentRequest = AcceptConsentRequest | RejectConsentRequest;

export function isConsentRequest(data: any): data is ConsentRequest {
    if (typeof data !== 'object' || data === null) {
        return false;
    }

    if (typeof data.action !== 'string' || typeof data.consentChallenge !== 'string') {
        return false;
    }

    if (data.action === 'accept') {
        if (!Array.isArray(data.scopes) || !data.scopes.every((scope: any) => typeof scope === 'string')) {
            return false;
        }
        if (typeof data.remember !== 'boolean') {
            return false;
        }
    } else return data.action === 'reject';

    return true;
}
