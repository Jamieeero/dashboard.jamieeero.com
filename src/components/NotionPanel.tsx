// Notion blocks being framed by most third-party sites, so a plain
// <iframe src="https://your-page.notion.site/..."> will usually come
// back blank. The reliable "simple embed" version is: publish the
// page ("Share" → "Publish to web"), then embed it through a
// no-code wrapper that's allowed to frame Notion, e.g. Embed.so or
// Notion2Site — paste that wrapper's embed URL below. If you'd
// rather skip the wrapper entirely, set NOTION_MODE to 'link' and
// this panel becomes a plain button that opens your page in a new tab.
const NOTION_MODE: 'embed' | 'link' = 'embed'
const NOTION_EMBED_SRC = 'https://embed.so/YOUR_EMBED_ID' // wrapper URL, if using embed mode
const NOTION_PAGE_URL = 'https://your-workspace.notion.site/your-page'

export default function NotionPanel() {
  return (
    <section className="panel panel--notion">
      <header className="panel__header">
        <h2>Notes</h2>
        <span className="meta">notion</span>
      </header>
      <div className="panel__body">
        {NOTION_MODE === 'embed' ? (
          <iframe src={NOTION_EMBED_SRC} title="Notion page" loading="lazy" />
        ) : (
          <div className="panel__body--padded">
            <a href={NOTION_PAGE_URL} target="_blank" rel="noreferrer">
              Open Notion page →
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
