export function sanitizeFirestorePayload<T>(data: T): T {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map((item) => (item === undefined ? null : strip(item)));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, strip(item)])
      );
    }
    return value;
  };
  return strip(data) as T;
}
