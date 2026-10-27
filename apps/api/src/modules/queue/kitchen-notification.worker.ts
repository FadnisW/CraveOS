import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { KITCHEN_QUEUE_NAME } from './queue.constants';
import { OrderTrackingGateway } from '../websockets/websockets.gateway';
import { redisConnectionOptions } from '../../common/config/env.validation';

@Injectable()
export class KitchenNotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KitchenNotificationWorker.name);
  private worker: Worker;

  constructor(private readonly websocketsGateway: OrderTrackingGateway) {}

  onModuleInit() {
    const connection = redisConnectionOptions();

    this.worker = new Worker(
      KITCHEN_QUEUE_NAME,
      async (job: Job) => {
        this.logger.log(`Processing BullMQ Job '${job.name}' [${job.id}]`);
        if (job.name === 'brand_order.created') {
          const { hubId, brandOrder } = job.data;
          this.websocketsGateway.emitKdsTicketUpdate(hubId, brandOrder);
          this.logger.log(`Emitted KDS Ticket WebSocket update for Hub ${hubId}, Brand ${brandOrder.brandId}`);
        }
      },
      {
        connection: {
          ...connection,
          maxRetriesPerRequest: null,
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully.`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
