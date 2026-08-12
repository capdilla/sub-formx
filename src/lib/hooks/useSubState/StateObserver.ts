type Fn<V> = (value: V) => void;

export type MiddlewareContext<T> = {
  key?: keyof T;
  value: unknown;
  state: T;
};

export type MiddlewareNext<T> = (ctx?: Partial<MiddlewareContext<T>>) => void;

export type Middleware<T> = (
  ctx: MiddlewareContext<T>,
  next: MiddlewareNext<T>
) => void;

export class StateObserver<T> {
  state: T;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribers: Map<keyof T, Fn<any>[]>;
  //subscribe to all keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allKeysSubscribers: Fn<any>[];
  middlewares: Middleware<T>[];

  constructor(defaultState: T, middlewares: Middleware<T>[] = []) {
    this.subscribers = new Map();
    this.allKeysSubscribers = [];
    this.state = defaultState;
    this.middlewares = [...middlewares];

    // Bind all methods to ensure they don't lose context
    this.subscribe = this.subscribe.bind(this);
    this.subscribeToAll = this.subscribeToAll.bind(this);
    this.unsubscribe = this.unsubscribe.bind(this);
    this.getDefaultValue = this.getDefaultValue.bind(this);
    this.setKeyState = this.setKeyState.bind(this);
    this.setState = this.setState.bind(this);
    this.addMiddleware = this.addMiddleware.bind(this);
  }

  addMiddleware(fn: Middleware<T>): () => void {
    this.middlewares.push(fn);
    return () => {
      this.middlewares = this.middlewares.filter((m) => m !== fn);
    };
  }

  private runMiddleware(
    ctx: MiddlewareContext<T>,
    finalFn: (ctx: MiddlewareContext<T>) => void
  ): void {
    const chain = this.middlewares;
    let index = 0;

    const execute = (currentCtx: MiddlewareContext<T>): void => {
      if (index < chain.length) {
        const middleware = chain[index++];
        middleware(currentCtx, (partialCtx) => {
          execute(partialCtx ? { ...currentCtx, ...partialCtx } : currentCtx);
        });
      } else {
        finalFn(currentCtx);
      }
    };

    execute(ctx);
  }

  subscribe<K extends keyof T>(name: K, fn: Fn<T[K]>) {
    if (!this.subscribers.has(name)) {
      this.subscribers.set(name, [fn]);
    } else {
      this.subscribers.get(name)?.push(fn);
    }

    return () => this.unsubscribe({ keyName: name, fn });
  }

  subscribeToAll(fn: Fn<T>) {
    this.allKeysSubscribers.push(fn);

    return () => this.unsubscribe({ fn });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unsubscribe({ keyName, fn }: { keyName?: keyof T; fn: Fn<any> }) {
    if (keyName) {
      this.subscribers.set(
        keyName,
        this.subscribers.get(keyName)?.filter((f) => f !== fn) ?? []
      );
    }

    this.allKeysSubscribers = this.allKeysSubscribers.filter((f) => f !== fn);
  }

  getDefaultValue(key: string) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    return this.state[key];
  }

  setKeyState<K extends keyof T>(key: K, value?: T[K]): (() => void) | void {
    const applySetKeyState = (ctx: MiddlewareContext<T>) => {
      const finalKey = (ctx.key ?? key) as K;
      const finalValue = ctx.value as T[K] | undefined;

      const applyState = (newValue?: T[K]) => {
        this.state = { ...this.state, [finalKey]: newValue };
        this.subscribers.get(finalKey)?.forEach((fn) => fn(newValue));
        this.allKeysSubscribers.forEach((fn) => fn(this.state));
      };

      const backupValue = this.state[finalKey];
      applyState(finalValue);
      return () => applyState(backupValue);
    };

    if (this.middlewares.length === 0) {
      return applySetKeyState({ key, value, state: this.state });
    }

    this.runMiddleware({ key, value, state: this.state }, applySetKeyState);
  }

  setState<K extends keyof T>(newState: Pick<T, K> | T): (() => void) | void {
    const applySetState = (ctx: MiddlewareContext<T>) => {
      const finalState = ctx.value as Pick<T, K> | T;

      const applyState = (_newState: Pick<T, K> | T) => {
        this.state = { ...this.state, ..._newState };

        if (_newState instanceof Object) {
          Object.keys(_newState).forEach((k) => {
            this.subscribers.get(k as keyof T)?.forEach((fn) => {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              //@ts-ignore
              fn(_newState[k]);
            });
          });
        }

        this.allKeysSubscribers.forEach((fn) => fn(this.state));
      };

      const backupState = { ...this.state };
      applyState(finalState);
      return () => applyState(backupState);
    };

    if (this.middlewares.length === 0) {
      return applySetState({ value: newState, state: this.state });
    }

    this.runMiddleware({ value: newState, state: this.state }, applySetState);
  }
}
