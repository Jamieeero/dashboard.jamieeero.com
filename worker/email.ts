export interface EmailEnv {
  DASHBOARD_DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  MS_CLIENT_ID?: string
  MS_CLIENT_SECRET?: string
}

type Provider = 'google' | 'microsoft'

interface AccountRow {
  id: string
  provider: Provider
  label: string
  email_address: string
  access_token: string
  refresh_token: string
  expires_at: number
  connected_at: string
}

export interface AccountSummary {
  id: string
  provider: Provider
  label: string
  emailAddress: string
  connectedAt: string
  openUrl: string
}

export interface EmailMessage {
  id: string // `${accountId}:${providerMessageId}`
  accountId: string
  provider: Provider
  sender: string
  subject: string
  preview: string
  receivedAt: string // ISO
  viewed: boolean
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function b64urlEncode(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return atob(padded)
}

function openUrlFor(provider: Provider, emailAddress: string): string {
  if (provider === 'google') {
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(emailAddress)}#inbox`
  }
  // Personal (outlook.com/hotmail/live) accounts live on outlook.live.com.
  // A work/school (Microsoft 365) account would need outlook.office.com instead.
  return 'https://outlook.live.com/mail/0/inbox'
}

function redirectUri(origin: string, provider: Provider): string {
  return `${origin}/api/email/callback/${provider}`
}

// ---------------------------------------------------------------
// Step 1: kick off the OAuth consent screen
// ---------------------------------------------------------------
export function startOAuth(provider: Provider, label: string, origin: string, env: EmailEnv): Response {
  const state = b64urlEncode({ label })

  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID) return new Response('GOOGLE_CLIENT_ID not configured', { status: 500 })
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri(origin, 'google'),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: 'https://www.googleapis.com/auth/gmail.readonly openid email',
      state,
    })
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  }

  if (!env.MS_CLIENT_ID) return new Response('MS_CLIENT_ID not configured', { status: 500 })
  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    redirect_uri: redirectUri(origin, 'microsoft'),
    response_type: 'code',
    response_mode: 'query',
    prompt: 'select_account',
    scope: 'offline_access openid email https://graph.microsoft.com/Mail.Read',
    state,
  })
  return Response.redirect(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`, 302)
}

// ---------------------------------------------------------------
// Step 2: exchange the ?code for tokens, look up the account's own
// address, and upsert a row (same id = reconnect just refreshes tokens)
// ---------------------------------------------------------------
export async function handleOAuthCallback(
  provider: Provider,
  request: Request,
  origin: string,
  env: EmailEnv
): Promise<Response> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state')
  const errParam = url.searchParams.get('error')

  if (errParam) return Response.redirect(`${origin}/?tab=email&emailError=${encodeURIComponent(errParam)}`, 302)
  if (!code) return new Response('Missing code', { status: 400 })

  let label = provider === 'google' ? 'Gmail' : 'Outlook'
  try {
    if (stateRaw) label = JSON.parse(b64urlDecode(stateRaw)).label || label
  } catch {
    // ignore malformed state, fall back to default label
  }

  try {
    const tokens =
      provider === 'google'
        ? await exchangeGoogleCode(code, origin, env)
        : await exchangeMicrosoftCode(code, origin, env)

    const emailAddress = await fetchOwnAddress(provider, tokens.access_token)
    const id = `${provider}:${emailAddress}`
    const expiresAt = Date.now() + tokens.expires_in * 1000

    await env.DASHBOARD_DB.prepare(
      `INSERT INTO email_accounts (id, provider, label, email_address, access_token, refresh_token, expires_at, connected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         access_token = excluded.access_token,
         refresh_token = COALESCE(NULLIF(excluded.refresh_token, ''), refresh_token),
         expires_at = excluded.expires_at`
    )
      .bind(id, provider, label, emailAddress, tokens.access_token, tokens.refresh_token ?? '', expiresAt, new Date().toISOString())
      .run()

    return Response.redirect(`${origin}/?tab=email`, 302)
  } catch (err) {
    return Response.redirect(`${origin}/?tab=email&emailError=${encodeURIComponent(String(err))}`, 302)
  }
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function exchangeGoogleCode(code: string, origin: string, env: EmailEnv): Promise<TokenResponse> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(origin, 'google'),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`)
  return res.json()
}

async function exchangeMicrosoftCode(code: string, origin: string, env: EmailEnv): Promise<TokenResponse> {
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.MS_CLIENT_ID ?? '',
      client_secret: env.MS_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(origin, 'microsoft'),
      grant_type: 'authorization_code',
      scope: 'offline_access openid email https://graph.microsoft.com/Mail.Read',
    }),
  })
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`)
  return res.json()
}

async function fetchOwnAddress(provider: Provider, accessToken: string): Promise<string> {
  if (provider === 'google') {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) throw new Error('Could not read Google account email')
    const data = await res.json<{ email: string }>()
    return data.email
  }
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Could not read Microsoft account email')
  const data = await res.json<{ mail?: string; userPrincipalName?: string }>()
  const address = data.mail || data.userPrincipalName
  if (!address) throw new Error('Microsoft account has no address')
  return address
}

// ---------------------------------------------------------------
// Token refresh — called lazily before every fetch
// ---------------------------------------------------------------
async function ensureFreshToken(account: AccountRow, env: EmailEnv): Promise<string> {
  if (account.expires_at > Date.now() + 60_000) return account.access_token

  const tokenUrl =
    account.provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'

  const body =
    account.provider === 'google'
      ? new URLSearchParams({
          refresh_token: account.refresh_token,
          client_id: env.GOOGLE_CLIENT_ID ?? '',
          client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
          grant_type: 'refresh_token',
        })
      : new URLSearchParams({
          refresh_token: account.refresh_token,
          client_id: env.MS_CLIENT_ID ?? '',
          client_secret: env.MS_CLIENT_SECRET ?? '',
          grant_type: 'refresh_token',
          scope: 'offline_access openid email https://graph.microsoft.com/Mail.Read',
        })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`${account.label}: token refresh failed (reconnect this account)`)
  const tokens = await res.json<TokenResponse>()
  const expiresAt = Date.now() + tokens.expires_in * 1000

  await env.DASHBOARD_DB.prepare(
    'UPDATE email_accounts SET access_token = ?, expires_at = ?, refresh_token = COALESCE(?, refresh_token) WHERE id = ?'
  )
    .bind(tokens.access_token, expiresAt, tokens.refresh_token ?? null, account.id)
    .run()

  return tokens.access_token
}

// ---------------------------------------------------------------
// Per-provider message fetch, last 7 days only
// ---------------------------------------------------------------
async function fetchGmailMessages(account: AccountRow, accessToken: string, sinceMs: number): Promise<EmailMessage[]> {
  const listRes = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?' +
      new URLSearchParams({ q: 'newer_than:7d', maxResults: '40' }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!listRes.ok) throw new Error(`${account.label}: ${await listRes.text()}`)
  const list = await listRes.json<{ messages?: { id: string }[] }>()
  if (!list.messages?.length) return []

  const messages = await Promise.all(
    list.messages.map(async (m) => {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!res.ok) return null
      const msg = await res.json<{
        id: string
        snippet?: string
        internalDate?: string
        payload?: { headers?: { name: string; value: string }[] }
      }>()
      const headers = msg.payload?.headers ?? []
      const from = headers.find((h) => h.name === 'From')?.value ?? 'Unknown sender'
      const subject = headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)'
      const receivedMs = msg.internalDate ? Number(msg.internalDate) : Date.now()
      return { msg, from, subject, receivedMs }
    })
  )

  return messages
    .filter((m): m is NonNullable<typeof m> => m !== null && m.receivedMs >= sinceMs)
    .map((m) => ({
      id: `${account.id}:${m.msg.id}`,
      accountId: account.id,
      provider: 'google' as const,
      sender: m.from,
      subject: m.subject,
      preview: m.msg.snippet ?? '',
      receivedAt: new Date(m.receivedMs).toISOString(),
      viewed: false,
    }))
}

async function fetchGraphMessages(account: AccountRow, accessToken: string, sinceMs: number): Promise<EmailMessage[]> {
  const sinceIso = new Date(sinceMs).toISOString()
  const params = new URLSearchParams({
    $select: 'id,subject,from,receivedDateTime,bodyPreview',
    $filter: `receivedDateTime ge ${sinceIso}`,
    $orderby: 'receivedDateTime desc',
    $top: '40',
  })
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`${account.label}: ${await res.text()}`)
  const data = await res.json<{
    value: {
      id: string
      subject?: string
      from?: { emailAddress?: { name?: string; address?: string } }
      receivedDateTime: string
      bodyPreview?: string
    }[]
  }>()

  return data.value.map((m) => ({
    id: `${account.id}:${m.id}`,
    accountId: account.id,
    provider: 'microsoft' as const,
    sender: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown sender',
    subject: m.subject || '(no subject)',
    preview: m.bodyPreview ?? '',
    receivedAt: m.receivedDateTime,
    viewed: false,
  }))
}

// ---------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------
export async function listAccounts(env: EmailEnv): Promise<Response> {
  const { results } = await env.DASHBOARD_DB.prepare(
    'SELECT id, provider, label, email_address, connected_at FROM email_accounts ORDER BY connected_at ASC'
  ).all<Pick<AccountRow, 'id' | 'provider' | 'label' | 'email_address' | 'connected_at'>>()

  const accounts: AccountSummary[] = results.map((r) => ({
    id: r.id,
    provider: r.provider,
    label: r.label,
    emailAddress: r.email_address,
    connectedAt: r.connected_at,
    openUrl: openUrlFor(r.provider, r.email_address),
  }))
  return Response.json(accounts)
}

export async function disconnectAccount(id: string, env: EmailEnv): Promise<Response> {
  await env.DASHBOARD_DB.prepare('DELETE FROM email_accounts WHERE id = ?').bind(id).run()
  await env.DASHBOARD_DB.prepare('DELETE FROM email_seen WHERE message_uid LIKE ?').bind(`${id}:%`).run()
  return Response.json({ ok: true })
}

export async function getUnifiedInbox(env: EmailEnv): Promise<Response> {
  const { results: accountRows } = await env.DASHBOARD_DB.prepare('SELECT * FROM email_accounts').all<AccountRow>()

  if (accountRows.length === 0) {
    return Response.json({ accounts: [], messages: [] })
  }

  const sinceMs = Date.now() - SEVEN_DAYS_MS
  const seenRes = await env.DASHBOARD_DB.prepare('SELECT message_uid FROM email_seen').all<{ message_uid: string }>()
  const seen = new Set(seenRes.results.map((r) => r.message_uid))

  const perAccount = await Promise.all(
    accountRows.map(async (account) => {
      try {
        const token = await ensureFreshToken(account, env)
        const messages =
          account.provider === 'google'
            ? await fetchGmailMessages(account, token, sinceMs)
            : await fetchGraphMessages(account, token, sinceMs)
        return { account, messages, error: null as string | null }
      } catch (err) {
        return { account, messages: [] as EmailMessage[], error: String(err) }
      }
    })
  )

  const accounts = perAccount.map(({ account, error }) => ({
    id: account.id,
    provider: account.provider,
    label: account.label,
    emailAddress: account.email_address,
    connectedAt: account.connected_at,
    openUrl: openUrlFor(account.provider, account.email_address),
    error,
  }))

  const messages = perAccount
    .flatMap((p) => p.messages)
    .map((m) => ({ ...m, viewed: seen.has(m.id) }))
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return Response.json({ accounts, messages })
}

export async function markSeen(request: Request, env: EmailEnv): Promise<Response> {
  const { id } = await request.json<{ id?: string }>()
  if (!id) return new Response('Missing id', { status: 400 })
  await env.DASHBOARD_DB.prepare('INSERT OR IGNORE INTO email_seen (message_uid, seen_at) VALUES (?, ?)')
    .bind(id, new Date().toISOString())
    .run()
  return Response.json({ ok: true })
}

export async function getFullMessage(request: Request, env: EmailEnv): Promise<Response> {
  const url = new URL(request.url)
  const uid = url.searchParams.get('id')
  if (!uid) return new Response('Missing id', { status: 400 })

  // uid is `${provider}:${emailAddress}:${providerMessageId}` — the account
  // id itself contains one colon, so split off just the last segment.
  const lastColon = uid.lastIndexOf(':')
  const accountId = uid.slice(0, lastColon)
  const providerMessageId = uid.slice(lastColon + 1)

  const account = await env.DASHBOARD_DB.prepare('SELECT * FROM email_accounts WHERE id = ?')
    .bind(accountId)
    .first<AccountRow>()
  if (!account) return new Response('Account not found', { status: 404 })

  const token = await ensureFreshToken(account, env)

  if (account.provider === 'google') {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${providerMessageId}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return new Response(await res.text(), { status: 502 })
    const msg = await res.json<{
      payload?: {
        headers?: { name: string; value: string }[]
        mimeType?: string
        body?: { data?: string }
        parts?: { mimeType: string; body?: { data?: string } }[]
      }
    }>()

    const headers = msg.payload?.headers ?? []
    const subject = headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)'
    const from = headers.find((h) => h.name === 'From')?.value ?? 'Unknown sender'

    function base64UrlToText(data: string): string {
      const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
      try {
        return decodeURIComponent(escape(atob(normalized)))
      } catch {
        return atob(normalized)
      }
    }

    function findPartData(mimeType: string): string | null {
      if (msg.payload?.mimeType === mimeType && msg.payload.body?.data) return msg.payload.body.data
      const part = msg.payload?.parts?.find((p) => p.mimeType === mimeType && p.body?.data)
      return part?.body?.data ?? null
    }

    const htmlData = findPartData('text/html')
    const textData = findPartData('text/plain')
    return Response.json({
      subject,
      from,
      html: htmlData ? base64UrlToText(htmlData) : null,
      text: textData ? base64UrlToText(textData) : null,
    })
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${providerMessageId}?$select=subject,from,body,webLink`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return new Response(await res.text(), { status: 502 })
  const msg = await res.json<{
    subject?: string
    from?: { emailAddress?: { name?: string; address?: string } }
    body?: { contentType: 'html' | 'text'; content: string }
    webLink?: string
  }>()

  return Response.json({
    subject: msg.subject ?? '(no subject)',
    from: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || 'Unknown sender',
    html: msg.body?.contentType === 'html' ? msg.body.content : null,
    text: msg.body?.contentType === 'text' ? msg.body.content : null,
    webLink: msg.webLink,
  })
}
