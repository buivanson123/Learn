import { z } from 'zod';

export type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: z.ZodType;
  response: z.ZodType;
};

export function defineContract<const C extends Record<string, Endpoint>>(c: C): C {
  return c;
}

export const contract = defineContract({
  getUser: {
    method: 'GET',
    path: '/users/:userId',
    response: z.object({ id: z.string(), name: z.string() }),
  },
  createPost: {
    method: 'POST',
    path: '/users/:userId/posts',
    body: z.object({ title: z.string().min(1), tags: z.array(z.string()).default([]) }),
    response: z.object({ postId: z.string(), title: z.string() }),
  },
  deletePost: {
    method: 'DELETE',
    path: '/users/:userId/posts/:postId',
    response: z.object({ deleted: z.literal(true) }),
  },
});

export type Contract = typeof contract;
