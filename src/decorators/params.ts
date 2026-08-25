import 'reflect-metadata';

export type ParamSource = 'body' | 'param' | 'query';

export interface ParamMetadata {
  index: number;
  source: ParamSource;
  name?: string;
}

export const ROUTE_PARAMS = Symbol.for('mini-nest:route-params');

function paramDecorator(source: ParamSource, name?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) return;

    const controller = target.constructor;
    const byHandler: Map<string | symbol, ParamMetadata[]> =
      Reflect.getOwnMetadata(ROUTE_PARAMS, controller) ?? new Map();
    const params = byHandler.get(propertyKey) ?? [];

    params.push({ index: parameterIndex, source, name });
    byHandler.set(propertyKey, params);
    Reflect.defineMetadata(ROUTE_PARAMS, byHandler, controller);
  };
}

export const Body = (): ParameterDecorator => paramDecorator('body');
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