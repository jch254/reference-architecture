import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';

import { ApiResponse } from '../../../shared/api-types';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((data) => {
        const res = context.switchToHttp().getResponse<Response>();
        // Don't wrap void/204 responses
        if (data === undefined || res.statusCode === 204) return data;
        return { data };
      }),
    );
  }
}
