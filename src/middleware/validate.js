export function validateBody(schema) {
  return (req, res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    req.query = schema.parse(req.query);
    next();
  };
}
