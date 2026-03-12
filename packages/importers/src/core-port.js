const METHOD_ALIASES = Object.freeze({
  importDocument: ["importDocument"],
  importMeal: ["importMeal", "addMeal"],
  importSamples: ["importSamples"],
});

export function assertCanonicalWritePort(port, requiredMethods = Object.keys(METHOD_ALIASES)) {
  if (!port || typeof port !== "object") {
    throw new TypeError("corePort must be an object");
  }

  const resolvedPort = {};

  for (const method of requiredMethods) {
    const aliases = METHOD_ALIASES[method] ?? [method];
    const implementation = aliases.find((alias) => typeof port[alias] === "function");

    if (!implementation) {
      throw new TypeError(`corePort.${aliases.join(" or corePort.")} must be a function`);
    }

    resolvedPort[method] = port[implementation].bind(port);
  }

  return resolvedPort;
}
