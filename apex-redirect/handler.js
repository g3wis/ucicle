// Scaleway Function `ucicle-apex-redirect` (runtime node26, handler `handler.handle`).
// Serves the ucicle.fr apex over HTTPS (custom domain with a managed certificate)
// and redirects every request to the site on https://www.ucicle.fr.
// Edge Services, which serves www, cannot also take the apex on the Starter plan.

export { handle };

const TARGET = 'https://www.ucicle.fr';

function handle(event) {
  const path = event.path || '/';
  const query = new URLSearchParams(event.queryStringParameters || {}).toString();

  return {
    statusCode: 301,
    headers: {
      Location: `${TARGET}${path}${query ? `?${query}` : ''}`,
      'Cache-Control': 'public, max-age=86400',
    },
    body: '',
  };
}
