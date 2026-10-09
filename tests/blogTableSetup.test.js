const ensureBlogTable = require('../src/utils/ensureBlogTable');

test('creates the blog table without altering its schema or dropping existing posts', async () => {
  const Blog = { sync: jest.fn().mockResolvedValue(undefined) };
  await ensureBlogTable(Blog);
  expect(Blog.sync).toHaveBeenCalledWith({ force: false, alter: false });
});

test('propagates database setup failures instead of reporting success', async () => {
  const Blog = { sync: jest.fn().mockRejectedValue(new Error('CREATE access denied')) };
  await expect(ensureBlogTable(Blog)).rejects.toThrow('CREATE access denied');
});

test('rejects setup if the blog model failed to load', async () => {
  await expect(ensureBlogTable(undefined)).rejects.toThrow('Blog model is unavailable');
});
