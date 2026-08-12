import { useCallback, useEffect, useMemo } from "react";

import { Middleware } from "../useSubState/StateObserver";
import { SubState, useSubState } from "../useSubState/useSubState";
import { Field, FormState, ValidationResult } from "../../interfaces/Field";

const FIELD_REQUIRED = "FIELD_REQUIRED";

export type GetFormState<T> = {
  isFormValid: boolean;
  fields: FormState<T>;
};

export interface FormProps<T> {
  defaultState: T;
  onFormChange?: (
    formState: FormState<T>,
    formObserver: SubState<FormState<T>>,
  ) => void;
  fields: Field<T>[];
  middleware?: Middleware<FormState<T>>[];
}

export type FormCore<T> = SubState<FormState<T>>;

export interface UseFormValue<T> {
  fields: Record<keyof T, Field<T>>;
  core: FormCore<T>;
  getFormState: () => GetFormState<T>;
  getFormValues: () => { values: T; isFormValid: boolean };
  updateFormState: <K extends keyof T>(newState: T | Pick<T, K>) => void;
  setShowValidation: (showValidation: boolean) => void;
  revalidateForm: (options?: ValidateFieldOptions) => void;
}

interface ValidateFieldOptions {
  showValidation?: boolean;
}
const validateField = <T>(
  field: Field<T>,
  formState: FormState<T>,
  options?: ValidateFieldOptions,
): ValidationResult => {
  const validation = field.validation;
  if (validation?.required) {
    return {
      isValid: Boolean(formState[field.name].value),
      showValidation: options?.showValidation ?? true,
      errorMessage:
        formState[field.name].validation?.errorMessage || FIELD_REQUIRED,
    };
  }

  if (validation?.customValidation) {
    const customValidationResult = validation.customValidation(formState);

    return {
      ...customValidationResult,
      showValidation: options?.showValidation ?? true,
    };
  }

  return {
    isValid: true,
    showValidation: false,
    errorMessage: "",
  };
};

const createDefaultState = <T>(
  fields: FormProps<T>["fields"],
  defaultState?: Partial<T>,
): FormState<T> => {
  if (!defaultState) {
    return {} as FormState<T>;
  }

  const indexedFields = fields.reduce(
    (acc, field) => {
      acc[field.name as string] = field;

      // add at default value if not present
      if (!(field.name in defaultState)) {
        defaultState[field.name] = "" as T[keyof T];
      }

      return acc;
    },
    {} as Record<string, Field<T>>,
  );

  const state = Object.entries(defaultState).reduce((acc, [key, value]) => {
    acc[key as keyof T] = {
      value: value as T[keyof T],
      validation: { isValid: true, showValidation: false, errorMessage: "" },
    };
    return acc;
  }, {} as FormState<T>);

  const fullState = Object.entries(state).reduce((acc, [key, value]) => {
    if (!indexedFields[key]) {
      return acc;
    }

    acc[key as keyof T] = {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-expect-error
      value: value.value,
      validation: validateField(indexedFields[key], state, {
        showValidation: false,
      }),
    };
    return acc;
  }, {} as FormState<T>);

  return fullState;
};

export function useForm<T>(props: FormProps<T>): UseFormValue<T> {
  const formState = useSubState<FormState<T>>(
    createDefaultState(props.fields, props.defaultState),
    props.middleware,
  );

  useEffect(() => {
    if (!props.onFormChange) {
      return;
    }
    const unsubscribe = formState.stateObserver.current.subscribeToAll(
      (newState: FormState<T>) => {
        if (props.onFormChange) {
          props.onFormChange(newState, formState);
        }
      },
    );

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onFormChange, formState]);

  const onFieldChange = useCallback(
    (field: Field<T>, value: unknown) => {
      const newState = {
        ...formState.stateObserver.current.state,
        [field.name]: {
          value: value as T[keyof T],
        },
      };

      const validation = validateField(field, newState);

      formState.setKeyState(field.name as keyof T, {
        value: value as T[keyof T],
        validation,
      });
    },
    [formState],
  );

  const fields = useMemo(() => {
    // recreate state if fields change
    formState.stateObserver.current.setState(
      createDefaultState(props.fields, props.defaultState),
    );

    return props.fields.reduce(
      (acc, field) => {
        acc[field.name] = {
          ...field,
          componentProps: {
            ...field.componentProps,
            onChange: (value: unknown) => {
              onFieldChange(field, value);
            },
            value: {
              key: field.name,
              stateObserver: formState.stateObserver.current,
            },
          },
        };
        return acc;
      },
      {} as Record<keyof T, Field<T>>,
    );
  }, [formState, onFieldChange, props.fields, props.defaultState]);

  const getEntries = useCallback(() => {
    const entries = Object.entries<{
      value: unknown;
      validation?: ValidationResult;
    }>(formState.stateObserver.current.state);
    return entries;
  }, [formState.stateObserver]);

  const isFormValid = useCallback(
    () => getEntries().every(([, field]) => field.validation?.isValid),
    [getEntries],
  );

  return {
    fields,
    core: formState,
    getFormState: () => {
      return {
        isFormValid: isFormValid(),
        fields: formState.stateObserver.current.state,
      };
    },
    getFormValues: () => {
      const formValues = getEntries().reduce((acc, [key, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        acc[key as keyof T] = (value as any).value;
        return acc;
      }, {} as T);

      return { values: formValues, isFormValid: isFormValid() };
    },
    updateFormState: (newState) =>
      formState.stateObserver.current.setState(
        createDefaultState(props.fields, newState as T),
      ),
    setShowValidation: (showValidation) => {
      const newState = getEntries().reduce((acc, [key, value]) => {
        acc[key as keyof T] = {
          value: value.value as T[keyof T],
          validation: {
            showValidation,
            isValid: Boolean(value.validation?.isValid),
            errorMessage: value.validation?.errorMessage || "",
          },
        };

        return acc;
      }, {} as FormState<T>);

      formState.stateObserver.current.setState(newState);
    },
    revalidateForm: (options?: ValidateFieldOptions) => {
      const newState = props.fields.reduce((acc, field) => {
        acc[field.name] = {
          value: formState.stateObserver.current.state[field.name].value,
          validation: validateField(
            field,
            formState.stateObserver.current.state,
            options,
          ),
        };

        return acc;
      }, {} as FormState<T>);

      formState.stateObserver.current.setState(newState);
    },
  };
}
