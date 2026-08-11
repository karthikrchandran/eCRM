"use client";

import { useCallback, useEffect, useState } from "react";

export type FormDraftValues = Record<string, string | boolean>;

function storageKey(key: string) {
  return `ecrm:form-draft:${key}`;
}

function readDraft(key: string): FormDraftValues {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const value = window.sessionStorage.getItem(storageKey(key));
    return value ? (JSON.parse(value) as FormDraftValues) : {};
  } catch {
    return {};
  }
}

export function useFormDraft(key: string) {
  const [values, setValues] = useState<FormDraftValues>(() => readDraft(key));

  const save = useCallback(
    (nextValues: FormDraftValues) => {
      setValues(nextValues);
      window.sessionStorage.setItem(storageKey(key), JSON.stringify(nextValues));
    },
    [key]
  );

  const saveForm = useCallback(
    (form: HTMLFormElement) => {
      const nextValues: FormDraftValues = {};

      for (const element of Array.from(form.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || !element.name) {
          continue;
        }
        nextValues[element.name] = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value;
      }

      save(nextValues);
    },
    [save]
  );

  const clear = useCallback(() => {
    setValues({});
    window.sessionStorage.removeItem(storageKey(key));
  }, [key]);

  const restoreForm = useCallback((form: HTMLFormElement) => {
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || !element.name || !(element.name in values)) {
        continue;
      }
      const value = values[element.name];
      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = value === true;
      } else if (typeof value === "string") {
        element.value = value;
      }
    }
  }, [values]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(values).length > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [values]);

  return { clear, hasDraft: Object.keys(values).length > 0, restoreForm, save, saveForm, values };
}
