import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

/** Every signed-in principal, including riders, may own a session. */
const SESSION_ROLES = [
  'CUSTOMER',
  'ADMIN',
  'HUB_STAFF',
  'HUB_MANAGER',
  'BRAND_OPS',
  'RIDER',
];

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @Public()
  @HttpCode(200)
  async requestOtp(@Body('email') email: string, @Request() req: any) {
    // `req.ip` honours Express `trust proxy`; see main.ts. Behind the Next BFF
    // the BFF forwards the browser address, so per-IP limits stay meaningful.
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return this.authService.requestOtp(email, ip);
  }

  @Post('verify-otp')
  @Public()
  @HttpCode(200)
  async verifyOtp(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('referralCode') referralCode?: string,
    @Body('acceptedLegal') acceptedLegal?: boolean,
  ) {
    return this.authService.verifyOtp(email, code, referralCode, acceptedLegal);
  }

  /**
   * Anonymous-friendly hydration. Always 200; `authenticated: false` means the
   * browser has no usable session. The BFF never sees a 401 here.
   */
  @Get('session')
  @Public()
  async getSession(@Headers('authorization') authorization?: string) {
    return this.authService.getSession(authorization);
  }

  /** Revokes the current token id in Redis, then the BFF clears the cookie. */
  @Post('logout')
  @Roles(...SESSION_ROLES)
  @HttpCode(200)
  async logout(@Request() req: any) {
    return this.authService.logout(req.user as AuthenticatedActor);
  }

  /** Mints a 60-second, socket-only ticket for the live order feed. */
  @Post('ws-ticket')
  @Roles(...SESSION_ROLES)
  @HttpCode(200)
  async issueWsTicket(@Request() req: any) {
    return this.authService.issueWsTicket(req.user as AuthenticatedActor);
  }

  /**
   * The signed-in account as the server sees it: membership, wallet and
   * addresses. The storefront uses this after a purchase instead of guessing
   * the new state locally.
   */
  @Get('me')
  @Roles('CUSTOMER', 'ADMIN', 'HUB_STAFF', 'HUB_MANAGER', 'BRAND_OPS')
  async getMe(@Request() req: any) {
    return this.authService.getMe((req.user as AuthenticatedActor).sub);
  }
}
