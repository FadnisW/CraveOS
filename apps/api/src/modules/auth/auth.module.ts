import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { JwtConfigModule } from '../../common/auth/jwt-config.module';

@Module({
  imports: [PassportModule, NotificationsModule, JwtConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
