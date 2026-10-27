import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY, ADMIN_SUB_ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TokenDenylistService } from '../auth/token-denylist.service';

interface JwtClaims {
  sub?: string;
  email?: string;
  role?: string;
  adminSubRole?: string | null;
  scopedHubId?: string | null;
  scopedBrandId?: string | null;
  jti?: string;
  exp?: number;
  scope?: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly tokenDenylist: TokenDenylistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Explicitly public routes (OTP, catalog reads, Razorpay webhook, ...)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredAdminSubRoles = this.reflector.getAllAndOverride<string[]>(
      ADMIN_SUB_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 2. FAIL CLOSED. A route with no policy is a bug, not a public route.
    //    Previously this returned `true`, which silently exposed every endpoint
    //    that forgot a @Roles() decorator (orders, payments, dispatch, ...).
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException(
        'Access denied: this endpoint has no access policy configured. ' +
          'Declare @Roles(...) or @Public() on the handler.',
      );
    }

    const request = context.switchToHttp().getRequest();
    let claims: JwtClaims | undefined = request.user;

    // Fallback: decode the Bearer token when no auth guard has attached request.user yet.
    if (!claims && request.headers.authorization) {
      try {
        const token = request.headers.authorization.replace('Bearer ', '').trim();
        claims = this.jwtService.verify(token);
      } catch {
        throw new UnauthorizedException('Invalid or expired authentication token');
      }
    }

    if (!claims) {
      throw new UnauthorizedException('Authentication required to access this resource');
    }

    if (!claims.sub) {
      throw new UnauthorizedException('Malformed authentication token');
    }

    // 2b. WebSocket tickets are single-purpose: they may open a socket, never
    //     call an HTTP route. Without this check a 60-second socket ticket
    //     would be a fully privileged API token.
    if (claims.scope === 'ws') {
      throw new UnauthorizedException(
        'WebSocket tickets cannot be used for API requests',
      );
    }

    // 2c. Refuse signed-out tokens. A JWT stays cryptographically valid until
    //     it expires, so logout revokes its `jti` in Redis. A Redis outage
    //     fails closed rather than accepting an unverifiable session.
    if (await this.tokenDenylist.isRevoked(claims.jti)) {
      throw new UnauthorizedException('This session has been signed out');
    }

    // 3. Re-read the identity from the database on every request.
    //    A JWT is a snapshot; roles can be revoked, hub scopes reassigned, or the
    //    account blocked. Trusting stale claims would keep a demoted/blocked user
    //    privileged for the full 30-day token lifetime.
    //
    //    Riders are a separate identity table (`Rider`), and their JWT `sub` is a
    //    rider id, not a user id — so resolve both kinds of principal here.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        role: true,
        adminSubRole: true,
        scopedHubId: true,
        scopedBrandId: true,
        isBlocked: true,
      },
    });

    let identity: {
      id: string;
      email: string | null;
      role: string;
      adminSubRole: string | null;
      scopedHubId: string | null;
      scopedBrandId: string | null;
      isBlocked: boolean;
    } | null = dbUser
      ? {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          adminSubRole: dbUser.adminSubRole,
          scopedHubId: dbUser.scopedHubId,
          scopedBrandId: dbUser.scopedBrandId,
          isBlocked: dbUser.isBlocked,
        }
      : null;

    if (!identity && claims.role === 'RIDER') {
      const rider = await this.prisma.rider.findUnique({
        where: { id: claims.sub },
        select: { id: true, name: true, status: true, currentHubId: true },
      });

      if (rider) {
        if (rider.status === 'SUSPENDED' || rider.status === 'REJECTED') {
          throw new ForbiddenException('This rider account is not active');
        }
        identity = {
          id: rider.id,
          email: null,
          role: 'RIDER',
          adminSubRole: null,
          scopedHubId: rider.currentHubId,
          scopedBrandId: null,
          isBlocked: false,
        };
      }
    }

    if (!identity) {
      throw new UnauthorizedException('Account no longer exists');
    }

    if (identity.isBlocked) {
      throw new ForbiddenException('This account has been blocked');
    }

    const user = {
      ...claims,
      sub: identity.id,
      email: identity.email,
      role: identity.role,
      adminSubRole: identity.adminSubRole,
      scopedHubId: identity.scopedHubId,
      scopedBrandId: identity.scopedBrandId,
    };
    request.user = user;

    const userRole: string = user.role || 'CUSTOMER';
    const userAdminSubRole: string | null = user.adminSubRole || null;
    const userScopedHubId: string | null = user.scopedHubId || null;
    const userScopedBrandId: string | null = user.scopedBrandId || null;

    // 4. Super Admin Override — SUPER_ADMIN has full platform access
    if (userRole === 'ADMIN' && userAdminSubRole === 'SUPER_ADMIN') {
      return true;
    }

    // 5. Validate Role inclusion
    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Access denied: Required role [${requiredRoles.join(', ')}], but user is '${userRole}'`,
      );
    }

    // 6. Validate Admin Sub-Role (if role is ADMIN and sub-roles are required)
    if (userRole === 'ADMIN' && requiredAdminSubRoles && requiredAdminSubRoles.length > 0) {
      if (!userAdminSubRole || !requiredAdminSubRoles.includes(userAdminSubRole)) {
        throw new ForbiddenException(
          `Access denied: Required admin sub-role [${requiredAdminSubRoles.join(
            ', ',
          )}], but user is '${userAdminSubRole || 'NONE'}'`,
        );
      }
    }

    // 7. Dynamic Path / Query / Body Parameter Scoping Logic
    const routePath: string = request.route?.path || request.url || '';
    const params = request.params || {};
    const query = request.query || {};
    const body = request.body || {};

    // Dynamic Hub Scoping for HUB_STAFF / HUB_MANAGER
    if (userRole === 'HUB_STAFF' || userRole === 'HUB_MANAGER') {
      let targetHubId: string | undefined = undefined;

      if (params.hubId) targetHubId = params.hubId;
      else if (params.id && routePath.includes('/hubs')) targetHubId = params.id;
      else if (query.hubId) targetHubId = query.hubId;
      else if (body.hubId) targetHubId = body.hubId;

      if (targetHubId && userScopedHubId !== targetHubId) {
        throw new ForbiddenException(
          `Access denied: User is assigned to Hub '${userScopedHubId}', cannot access Hub '${targetHubId}'`,
        );
      }
    }

    // Dynamic Brand Scoping for BRAND_OPS
    if (userRole === 'BRAND_OPS') {
      let targetBrandId: string | undefined = undefined;

      if (params.brandId) targetBrandId = params.brandId;
      else if (params.id && routePath.includes('/brands')) targetBrandId = params.id;
      else if (query.brandId) targetBrandId = query.brandId;
      else if (body.brandId) targetBrandId = body.brandId;

      if (targetBrandId && userScopedBrandId !== targetBrandId) {
        throw new ForbiddenException(
          `Access denied: User is assigned to Brand '${userScopedBrandId}', cannot access Brand '${targetBrandId}'`,
        );
      }
    }

    return true;
  }
}
