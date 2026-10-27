import { Global, Module } from '@nestjs/common';
import { TokenDenylistService } from './token-denylist.service';

/**
 * Global so the RolesGuard, the socket gateway and AuthService all check the
 * same revocation list without every feature module re-providing it.
 */
@Global()
@Module({
  providers: [TokenDenylistService],
  exports: [TokenDenylistService],
})
export class TokenDenylistModule {}
