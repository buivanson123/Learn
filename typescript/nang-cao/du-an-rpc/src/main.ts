import { contract } from './contract.ts';
import { buildPath, createServer } from './server.ts';

const posts = new Map<string, { title: string; tags: string[] }>();
let seq = 0;

const call = createServer(contract, {
  getUser: async ({ params }) => ({ id: params.userId, name: 'Sơn' }),

  createPost: async ({ params, body }) => {
    const postId = `p${++seq}`;
    posts.set(postId, { title: body!.title, tags: body!.tags });
    console.log(`  [db] user=${params.userId} lưu ${postId}: "${body!.title}" tags=${JSON.stringify(body!.tags)}`);
    return { postId, title: body!.title };
  },

  deletePost: async ({ params }) => {
    if (!posts.delete(params.postId)) throw new Error(`không tìm thấy ${params.postId}`);
    return { deleted: true as const };
  },
});

console.log('— đường dẫn sinh từ params —');
console.log(buildPath(contract.deletePost, { userId: 'u 1', postId: 'p1' }));

console.log('\n— gọi hợp lệ —');
console.log(await call('getUser', { params: { userId: 'u1' }, body: undefined }));
console.log(await call('createPost', { params: { userId: 'u1' }, body: { title: 'Bài đầu tiên' } }));

console.log('\n— body sai schema —');
console.log(await call('createPost', { params: { userId: 'u1' }, body: { title: '' } }));

console.log('\n— handler ném lỗi —');
console.log(await call('deletePost', { params: { userId: 'u1', postId: 'p999' }, body: undefined }));

console.log('\n— xoá thật —');
console.log(await call('deletePost', { params: { userId: 'u1', postId: 'p1' }, body: undefined }));
