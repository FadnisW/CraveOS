import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @Public()
  async requestOtp(@Body('email') email: string) {
    return this.authService.requestOtp(email);
  }

  @Post('verify-otp')
  @Public()
  async verifyOtp(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('referralCode') referralCode?: string,
  ) {
    return this.authService.verifyOtp(email, code, referralCode);
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
