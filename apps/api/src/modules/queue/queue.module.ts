import { Module, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { KITCHEN_QUEUE, KITCHEN_QUEUE_NAME } from './queue.constants';
import { KitchenNotificationWorker } from './kitchen-notification.worker';
import { WebsocketsModule } from '../websockets/websockets.module';
import { redisConnectionOptions } from '../../common/config/env.validation';

@Module({
  imports: [WebsocketsModule],
  providers: [
    KitchenNotificationWorker,
    {
      provide: KITCHEN_QUEUE,
      useFactory: () => {
        const logger = new Logger('QueueModule');
        const connection = redisConnectionOptions();

        logger.log(
          `🐂 Initializing BullMQ Queue '${KITCHEN_QUEUE_NAME}' on ${connection.host}...`,
        );

        return new Queue(KITCHEN_QUEUE_NAME, {
          connection: {
            ...connection,
            maxRetriesPerRequest: null,
          },
        });
      },
    },
  ],
  exports: [KITCHEN_QUEUE, KitchenNotificationWorker],
})
export class QueueModule {}

