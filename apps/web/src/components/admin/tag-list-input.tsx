"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";

/**
 * One entry per line. A textarea rather than a chip editor: the server strips
 * blank lines before writing, so pasting a bulleted list out of a document
 * just works instead of producing validation errors.
 */
export function TagListInput({
  id,
  label,
  max,
  defaultValue,
}: {
  id: string;
  label: string;
  max: number;
  defaultValue: string[];
}) {
  const [value, setValue] = useState(defaultValue.join("\n"));
  const filled = value.split("\n").filter((line) => line.trim()).length;

  return (
    <Field
      id={id}
      label={label}
      hint={`Mỗi dòng một mục, tối đa ${max} mục. Đang có ${filled}.`}
      error={filled > max ? `Chỉ giữ tối đa ${max} mục.` : undefined}
    >
      <textarea
        id={id}
        name={id}
        rows={4}
        className="control"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={filled > max}
      />
    </Field>
  );
}
