/**
 * The API origin used for the live order socket.
 *
 * Next route handlers cannot proxy a WebSocket upgrade, so the browser
 * connects to the API directly. Production must set NEXT_PUBLIC_SOCKET_URL;
 * there is no silent localhost fallback outside development.
 */
export function socketBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
  }

  return null;
}
