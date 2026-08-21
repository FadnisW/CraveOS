import { Module, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { KITCHEN_QUEUE, KITCHEN_QUEUE_NAME } from './queue.constants';
import { KitchenNotificationWorker } from './kitchen-notification.worker';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [WebsocketsModule],
  providers: [
    KitchenNotificationWorker,
    {
      provide: KITCHEN_QUEUE,
      useFactory: () => {
        const logger = new Logger('QueueModule');
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const parsed = new URL(redisUrl);

        logger.log(`🐂 Initializing BullMQ Queue '${KITCHEN_QUEUE_NAME}' on ${parsed.host}...`);

        return new Queue(KITCHEN_QUEUE_NAME, {
          connection: {
            host: parsed.hostname || 'localhost',
            port: parseInt(parsed.port || '6379', 10),
            maxRetriesPerRequest: null,
          },
        });
      },
    },
  ],
  exports: [KITCHEN_QUEUE, KitchenNotificationWorker],
})
export class QueueModule {}

