import type { z } from 'zod';
import type { Endpoint } from './contract.ts';

export type PathParams<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | PathParams<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

export type ParamsOf<E extends Endpoint> =
  [PathParams<E['path']>] extends [never] ? Record<never, never>
  : { [K in PathParams<E['path']>]: string };

export type BodyOf<E extends Endpoint> =
  E extends { body: infer B extends z.ZodType } ? z.input<B> : undefined;

export type ResultOf<E extends Endpoint> = z.output<E['response']>;

export type Input<E extends Endpoint> = { params: ParamsOf<E>; body: BodyOf<E> };

export type Handler<E extends Endpoint> = (input: {
  params: ParamsOf<E>;
  body: z.output<E['body'] & z.ZodType> | undefined;
}) => Promise<ResultOf<E>>;

export type Ok<T> = { ok: true; data: T };
export type Err = { ok: false; code: 'VALIDATION' | 'HANDLER'; message: string; path?: (string | number)[] };
export type Result<T> = Ok<T> | Err;
