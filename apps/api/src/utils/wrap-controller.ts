export function WrapController<T extends object>(controller: T): T {
  const wrapped: any = {};

  for (const key of Object.getOwnPropertyNames(controller)) {
    const fn = (controller as any)[key];
    if (typeof fn === "function") {
      wrapped[key] = async (req: any, res: any, next: any) => {
        try {
          await fn(req, res, next);
        } catch (err) {
          next(err);
        }
      };
    } else {
      wrapped[key] = fn;
    }
  }

  return wrapped;
}
