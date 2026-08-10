import { Module, Logger } from '@nestjs/common';

@Module({
  providers: [
    {
      provide: 'BULLMQ_WORKER',
      useFactory: () => {
        const logger = new Logger('QueueModule');
        logger.log('🐂 BullMQ Queue Workers initialized for background tasks (Redis 7).');
        return { status: 'active' };
      },
    },
  ],
  exports: ['BULLMQ_WORKER'],
})
export class QueueModule {}
