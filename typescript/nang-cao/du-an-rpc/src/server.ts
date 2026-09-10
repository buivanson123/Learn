import { z } from 'zod';
import type { Endpoint } from './contract.ts';
import type { Handler, Input, Result, ResultOf } from './types.ts';

export type Contractish = { [key: string]: Endpoint };
export type Handlers<C extends Contractish> = { [K in keyof C]: Handler<C[K]> };

export function buildPath<E extends Endpoint>(ep: E, params: Record<string, string>): string {
  return ep.path.replace(/:([A-Za-z0-9_]+)/g, (_m, key: string) => {
    const v = params[key];
    if (v === undefined) throw new Error(`thiếu tham số :${key}`);
    return encodeURIComponent(v);
  });
}

export function createServer<C extends { [K in keyof C]: Endpoint }>(contract: C, handlers: Handlers<C>) {
  return async function call<K extends keyof C>(
    name: K,
    input: Input<C[K]>
  ): Promise<Result<ResultOf<C[K]>>> {
    const ep = contract[name];
    let body: unknown = input.body;

    if (ep.body) {
      const parsed = ep.body.safeParse(input.body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return { ok: false, code: 'VALIDATION', message: first?.message ?? 'sai dữ liệu', path: first?.path as (string | number)[] };
      }
      body = parsed.data;
    }

    try {
      const out = await handlers[name]({ params: input.params, body } as never);
      return { ok: true, data: ep.response.parse(out) as ResultOf<C[K]> };
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { ok: false, code: 'VALIDATION', message: 'response không khớp schema' };
      }
      return { ok: false, code: 'HANDLER', message: (e as Error).message };
    }
  };
}
