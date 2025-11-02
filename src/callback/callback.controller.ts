import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ValidatedPayload } from 'src/common/decorators/validated-payload.decorator';
import { BillingMessagePatterns } from 'src/common/enums/message-patterns';
import { TcpExceptionFilter } from 'src/common/filters/tcp-exception.filter';
import { CallbackService } from './callback.service';
import { AocRedirectParamsDto } from './dto/aoc-redirect-params.dto';

@UseFilters(TcpExceptionFilter)
@Controller()
export class CallbackController {
  constructor(private readonly callbackService: CallbackService) {}

  @MessagePattern(BillingMessagePatterns.AOC_REDIRECTION)
  async handleAocRedirection(
    @ValidatedPayload()
    payload: {
      params: AocRedirectParamsDto;
      query: Record<string, any>;
    },
  ) {
    const path = payload.params?.path;
    const subscriptionId =
      Array.isArray(path) &&
      path.length === 3 &&
      path[0] === 'subscriptions' &&
      path[2] === 'redirect'
        ? path[1]
        : undefined;

    // sample response
    return {
      statusCode: 302,
      headers: {
        Location: await this.callbackService.resolveUrl(
          subscriptionId ?? '#',
          payload.query,
        ),
      },
      body: null,
    };
  }
}
