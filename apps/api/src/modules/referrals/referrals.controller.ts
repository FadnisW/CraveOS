import { Controller, Get, Request } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedActor } from '../../common/types/authenticated-actor';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('me')
  @Roles('CUSTOMER', 'ADMIN')
  async getMyReferrals(@Request() req: any) {
    return this.referralsService.getMyReferrals(
      (req.user as AuthenticatedActor).sub,
    );
  }
}
