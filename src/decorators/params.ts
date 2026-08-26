import 'reflect-metadata';

export type ParamSource = 'body' | 'param' | 'query';

export interface ParamMetadata {
  index: number;
  source: ParamSource;
  name?: string;
  schema?: unknown;
}

export const ROUTE_PARAMS = Symbol.for('mini-nest:route-params');

function paramDecorator(source: ParamSource, name?: string, schema?: unknown): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) return;

    const controller = target.constructor;
    const byHandler: Map<string | symbol, ParamMetadata[]> =
      Reflect.getOwnMetadata(ROUTE_PARAMS, controller) ?? new Map();
    const params = byHandler.get(propertyKey) ?? [];

    params.push({ index: parameterIndex, source, name, schema });
    byHandler.set(propertyKey, params);
    Reflect.defineMetadata(ROUTE_PARAMS, byHandler, controller);
  };
}

export const Body = (schema?: unknown): ParameterDecorator => paramDecorator('body', undefined, schema);
export const Param = (name: string): ParameterDecorator => paramDecorator('param', name);
export const Query = (name: string): ParameterDecorator => paramDecorator('query', name);

export function getParamMetadata(
  target: object,
  handlerName: string | symbol,
): ParamMetadata[] {
  const byHandler: Map<string | symbol, ParamMetadata[]> | undefined =
    Reflect.getMetadata(ROUTE_PARAMS, target);

  return byHandler?.get(handlerName) ?? [];
}