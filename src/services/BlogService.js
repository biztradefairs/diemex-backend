const Joi = require('joi');
const { Op } = require('sequelize');

const schema = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  slug: Joi.string().trim().max(255).pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).allow(''),
  excerpt: Joi.string().trim().max(500).allow('').default(''),
  content: Joi.string().trim().min(1).max(200000).required(),
  author: Joi.string().trim().min(1).max(120).default('DIEMEX Team'),
  category: Joi.string().trim().min(1).max(80).default('Industry Insights'),
  image: Joi.string().uri({ scheme: ['https', 'http'] }).max(2048).allow('', null).default(null),
  status: Joi.string().valid('draft', 'published').default('draft'),
  metaTitle: Joi.string().trim().max(255).allow('').default(''),
  metaDescription: Joi.string().trim().max(320).allow('').default(''),
}).unknown(false);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function generateSlug(title) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

class BlogService {
  get model() { return require('../models').getModel('Blog'); }

  validate(input) {
    const { value, error } = schema.validate(input, { abortEarly: false });
    if (error) fail(error.details.map(detail => detail.message).join('. '));
    value.slug = value.slug || generateSlug(value.title);
    if (!value.slug) fail('Please enter a URL slug using letters and numbers.');
    value.image = value.image || null;
    return value;
  }

  async list(query = {}, admin = false) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 12);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      fail('Invalid pagination parameters.');
    }
    const where = admin ? {} : { status: 'published', publishedAt: { [Op.lte]: new Date() } };
    if (admin && query.status && query.status !== 'all') {
      if (!['draft', 'published'].includes(query.status)) fail('Invalid blog status.');
      where.status = query.status;
    }
    if (query.search) {
      if (typeof query.search !== 'string' || query.search.length > 200) fail('Invalid search query.');
      where[Op.or] = [
        { title: { [Op.like]: '%' + query.search + '%' } },
        { author: { [Op.like]: '%' + query.search + '%' } },
      ];
    }
    const result = await this.model.findAndCountAll({
      where,
      attributes: { exclude: ['content'] },
      order: admin ? [['updatedAt', 'DESC'], ['id', 'ASC']] : [['publishedAt', 'DESC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });
    return { blogs: result.rows, total: result.count, page, totalPages: Math.ceil(result.count / limit) };
  }

  async bySlug(slug) {
    const blog = await this.model.findOne({
      where: { slug, status: 'published', publishedAt: { [Op.lte]: new Date() } },
    });
    if (!blog) fail('Blog not found.', 404);
    return blog;
  }

  async byId(id) {
    const blog = await this.model.findByPk(id);
    if (!blog) fail('Blog not found.', 404);
    return blog;
  }

  async save(input, id) {
    const current = id ? await this.byId(id) : null;
    const value = this.validate(input);
    // Preserve the first publication date while a post stays published.
    value.publishedAt = value.status === 'published'
      ? (current && current.status === 'published' && current.publishedAt ? current.publishedAt : new Date())
      : null;
    try {
      return current ? await current.update(value) : await this.model.create(value);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') fail('This URL slug is already used by another blog.', 409);
      throw error;
    }
  }

  async remove(id) {
    const blog = await this.byId(id);
    await blog.destroy();
  }
}

module.exports = new BlogService();
