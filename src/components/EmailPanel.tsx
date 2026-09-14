import { useState } from 'react'

type Provider = 'outlook' | 'gmail'

interface ProviderState {
  connected: boolean
}

export default function EmailPanel() {
  const [providers, setProviders] = useState<Record<Provider, ProviderState>>({
    outlook: { connected: false },
    gmail: { connected: false },
  })

  // Stubbed for now — wiring this up needs an Outlook (Microsoft Graph)
  // and a Gmail (Google) OAuth app registered, plus worker routes to
  // handle the OAuth callback and token storage/refresh.
  function connect(provider: Provider) {
    setProviders((prev) => ({ ...prev, [provider]: { connected: !prev[provider].connected } }))
  }

  return (
    <section className="panel panel--email">
      <header className="panel__header">
        <h2>Email</h2>
      </header>

      <div className="panel__body panel__body--padded email__body">
        <p className="notion-empty">
          Unified inbox for Outlook and Gmail — connect both accounts below to check mail here
          without logging into either separately.
        </p>

        <div className="email__providers">
          <div className="email__provider-card">
            <div className="email__provider-info">
              <span className="email__provider-name">Outlook</span>
              <span className="email__provider-status">
                {providers.outlook.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <button className="open-in-btn" onClick={() => connect('outlook')}>
              {providers.outlook.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>

          <div className="email__provider-card">
            <div className="email__provider-info">
              <span className="email__provider-name">Gmail</span>
              <span className="email__provider-status">
                {providers.gmail.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <button className="open-in-btn" onClick={() => connect('gmail')}>
              {providers.gmail.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </div>

        <p className="email__note">
          These buttons are placeholders for now. Real connections need an Outlook
          (Microsoft Graph) and a Gmail (Google) OAuth app registered, plus worker
          routes to handle the OAuth callback and store/refresh tokens — similar to
          how Calendar and Notion talk to their APIs server-side.
        </p>
      </div>
    </section>
  )
}