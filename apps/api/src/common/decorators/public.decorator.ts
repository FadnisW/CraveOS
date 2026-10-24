import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as intentionally reachable without authentication.
 *
 * The global RolesGuard is fail-closed: any route that declares neither
 * `@Public()` nor `@Roles(...)` is denied. This makes a forgotten decorator
 * a visible 403 in development instead of a silent open endpoint in production.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
