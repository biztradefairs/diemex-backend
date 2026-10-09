# Blog publishing

The Blogs sidebar links to /admin/blogs in the frontend. Create a draft, add a cover image, author, introduction and Markdown content, then select Published and save. Edit a published post to update it; select Draft to remove it from public pages. Delete permanently removes the post.

Public pages are /blogs and /blogs/:slug. They render on the server and fetch current published content without a persistent cache.

The blogs MySQL table is registered with model initialization and is created independently before the shared sync, so an unrelated schema failure cannot skip it. Restart the backend after deployment, or run npm run migrate:blogs to create the missing table immediately. This command syncs only Blog with force: false and alter: false, preserving existing rows and columns.

Image uploads use the existing Cloudinary service and configuration (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). The editor also accepts an existing HTTPS image URL. No new dependencies are required.

Content supports paragraphs, headings, bold, italic, lists, block quotes and links. Raw HTML is displayed as text. Draft previews are available in the editor.

API routes:
- GET /api/blogs: published posts only, with page, limit and search.
- GET /api/blogs/slug/:slug: a published post.
- GET /api/blogs/admin and /api/blogs/admin/:id: authenticated admin/editor access.
- POST /api/blogs, PUT /api/blogs/:id, DELETE /api/blogs/:id: admin/editor only.
- POST /api/blogs/upload: admin/editor cover upload, field image, JPG/PNG/WebP up to 5 MB.

Run the isolated API tests with:
node node_modules/jest/bin/jest.js tests/blogs.test.js --runInBand --coverage=false --cache=false

The tests use a model test double and Cloudinary stub; they do not connect to a database or cloud account.
