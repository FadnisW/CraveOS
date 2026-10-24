/**
 * The authenticated principal attached to the request by RolesGuard.
 *
 * `sub` is a User id for staff/customers and a Rider id for rider tokens.
 */
export interface AuthenticatedActor {
  sub: string;
  role?: string;
  adminSubRole?: string | null;
  scopedHubId?: string | null;
  scopedBrandId?: string | null;
}
