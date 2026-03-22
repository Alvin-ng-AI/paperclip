import type { AdapterConfigFieldsProps } from "./types";
import { Field } from "../components/agent-config-primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export function LocalWorkspaceRuntimeFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
  models,
}: AdapterConfigFieldsProps) {
  if (!models || models.length === 0) return null;

  const currentModel = isCreate
    ? (values?.model ?? "")
    : eff("adapterConfig", "model", String(config.model ?? ""));

  function handleChange(value: string) {
    if (isCreate) {
      set?.({ model: value });
    } else {
      mark("adapterConfig", "model", value || undefined);
    }
  }

  return (
    <Field label="Model" hint="LLM model to use for this agent. Determines cost and capability.">
      <Select value={currentModel} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a model…" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
