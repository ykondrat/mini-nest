import 'reflect-metadata';

export const CONTROLLER_PREFIX = Symbol.for('mini-nest:controller:prefix');

export function Controller(prefix = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONTROLLER_PREFIX, prefix, target);
  };
}

export function getControllerPrefix(target: object): string {
  return Reflect.getMetadata(CONTROLLER_PREFIX, target) ?? '';
}