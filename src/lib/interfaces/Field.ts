import { Value } from "./Value";

export type FormState<T> = {
  [K in keyof T]: { value: T[K]; validation?: ValidationResult };
};

type ComponentProps<C> = {
  onChange: (value: unknown) => void;
  value: Value<unknown>;
} & React.ComponentPropsWithRef<
  React.ComponentType<C> | keyof React.JSX.IntrinsicElements
>;

export interface ValidationResult {
  isValid: boolean;
  showValidation: boolean;
  errorMessage: string;
}

export interface Validation<T> {
  required?: boolean;
  errorMessage?: string;
  customValidation?: (
    values: FormState<T>
  ) => Omit<ValidationResult, "showValidation">;
  showValidation?: boolean;
  // TODO: Implement dependsOn when someone needs it
  // dependsOn?: (keyof T)[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Field<T, C = any> {
  name: keyof T;
  id?: string;
  component?: React.ElementType<C>;
  componentProps?: ComponentProps<C>;
  validation?: Validation<T>;
}
