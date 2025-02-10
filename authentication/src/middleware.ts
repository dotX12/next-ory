import { NextRequest, NextResponse } from 'next/server'
import { getFrontendApi } from '@/ory/sdk/server'


function getSafeReturnTo(request: NextRequest, fallback: string): string {
    const rawReturnTo = request.nextUrl.searchParams.get('return_to')
    if (!rawReturnTo) {
        return fallback
    }
    try {
        const url = new URL(rawReturnTo)
        return url.toString()
    } catch (_) {
        return fallback
    }
}

function getOriginalUrl(request: NextRequest): string {
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    const derivedOrigin = `${forwardedProto}://${forwardedHost}`

    const path = request.nextUrl.pathname
    const search = request.nextUrl.search

    return derivedOrigin + path + search
}

export async function middleware(request: NextRequest) {
    const api = await getFrontendApi()
    const cookieStore = request.cookies;

    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'

    const derivedOrigin = forwardedProto + '://' + forwardedHost
    console.debug('Derived origin:', derivedOrigin)
    console.debug("Forwarded host:", forwardedHost)
    console.debug("Forwarded proto:", forwardedProto)

    const session = await api
        .toSession({
            cookie: 'ory_kratos_session=' + cookieStore.get('ory_kratos_session')?.value,
        })
        .then((res) => res.data)
        .catch(() => null)


    const path = request.nextUrl.pathname
    const searchParams = request.nextUrl.searchParams


    const loginChallenge = searchParams.get('login_challenge')
    const consentChallenge = searchParams.get('consent_challenge')
    // Kratos flow
    const kratosFlowId = searchParams.get('flow')


    if (!session && !path.startsWith('/flow')) {
        const originalUrl = getOriginalUrl(request)
        const loginChallenge = searchParams.get('login_challenge') ?? ""

        let loginUrl = `${derivedOrigin}/flow/login`

        const sp = new URLSearchParams()
        if (loginChallenge) {
            sp.set('login_challenge', loginChallenge)
        }
        sp.set('return_to', originalUrl)

        loginUrl += `?${sp.toString()}`

        return NextResponse.redirect(loginUrl)
    }


    if (!session && path.startsWith('/flow')) {
        console.debug('No session, but in flow. Redirecting to root.')
        return NextResponse.next()
    }

    if (session && path.startsWith('/flow')) {
        if (loginChallenge || consentChallenge) {
            console.debug('Hydra flow, continuing.')
            return NextResponse.next()
        }
        if (kratosFlowId) {
            console.debug('Kratos flow, continuing.')
            return NextResponse.next()
        }

        const safeUrl = getSafeReturnTo(request, derivedOrigin)
        console.debug('Kratos flow, but no flow ID. Redirecting to:', safeUrl)
        return NextResponse.redirect(safeUrl)
    }

    console.debug('No flow, no session, no flow ID. Continuing.')
    return NextResponse.next()
}

export const config = {
    matcher: '/((?!api|_next/static|_next/image|favicon.png|sitemap.xml|robots.txt|sw.js|manifest.json|icon-72.png|icon-128.png|icon-144.png|icon-192.png|icon-512.png|mt-logo-orange.png).*)',
}
