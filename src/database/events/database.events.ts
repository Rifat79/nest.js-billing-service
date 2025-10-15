export class DatabaseEvent {
  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly data: any,
    public readonly metadata: {
      serviceName: string;
      timestamp: Date;
      version: number;
      correlationId?: string;
      causationId?: string;
      userId?: string;
    },
  ) {}

  toJSON() {
    return {
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      data: this.data,
      metadata: this.metadata,
    };
  }
}
