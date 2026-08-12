import { useCallback, useRef } from "react";
import { Middleware, StateObserver } from "./StateObserver";

export interface SubState<T> {
  stateObserver: React.MutableRefObject<StateObserver<T>>;
  setKeyState: <K extends keyof T>(
    key: keyof T,
    value?: T[K] | undefined
  ) => void;
  setState: <K extends keyof T>(newState: T | Pick<T, K>) => void;
  getState: () => T;
  addMiddleware: (fn: Middleware<T>) => () => void;
}

export function useSubStateBase<T>(observer: StateObserver<T>): SubState<T> {
  const refSub = useRef(observer);

  const setKeyState = useCallback(function <K extends keyof T>(
    key: keyof T,
    value?: T[K]
  ) {
    refSub.current.setKeyState(key, value);
  }, []);

  const setState = useCallback(function <K extends keyof T>(
    newState: Pick<T, K> | T
  ) {
    refSub.current.setState(newState);
  }, []);

  const getState = useCallback(() => {
    return refSub.current.state;
  }, []);

  const addMiddleware = useCallback((fn: Middleware<T>) => {
    return refSub.current.addMiddleware(fn);
  }, []);

  return {
    stateObserver: refSub,
    setState,
    setKeyState,
    getState,
    addMiddleware,
  };
}

export function useSubState<T>(initialState: T, middlewares?: Middleware<T>[]): SubState<T> {
  return useSubStateBase(new StateObserver<T>(initialState, middlewares));
}
