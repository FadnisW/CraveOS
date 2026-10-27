/**
 * The authenticated principal attached to the request by RolesGuard.
 *
 * `sub` is a User id for staff/customers and a Rider id for rider tokens.
 * `jti` is the token id used for server-side revocation; `scope` marks
 * short-lived WebSocket tickets that must never be accepted on HTTP routes.
 */
export interface AuthenticatedActor {
  sub: string;
  role?: string;
  adminSubRole?: string | null;
  scopedHubId?: string | null;
  scopedBrandId?: string | null;
  jti?: string;
  exp?: number;
  scope?: string;
}
