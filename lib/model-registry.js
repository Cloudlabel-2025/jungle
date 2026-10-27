// Next.js can reload schema definitions while Mongoose retains its model cache.
// Replace only a model whose definition changed; never drop its collection/data.
export function registerModel(registry, name, schema) {
  const signature = JSON.stringify(
    { fields: schema.obj, indexes: schema.indexes() },
    (_key, value) => (typeof value === "function" ? value.toString() : value),
  );
  const existing = registry.models[name];
  if (existing?.$codewildSchemaSignature === signature) return existing;
  if (existing) registry.deleteModel(name);
  const model = registry.model(name, schema);
  model.$codewildSchemaSignature = signature;
  return model;
}
