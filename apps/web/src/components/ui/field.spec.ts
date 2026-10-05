import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field } from "./field";

const render = (
  props: { error?: string; hint?: string },
  child: ReactElement = createElement("input", { id: "f" }),
) =>
  renderToStaticMarkup(
    createElement(
      Field,
      { id: "f", label: "Tên", ...props } as Parameters<typeof Field>[0],
      child,
    ),
  );

describe("Field", () => {
  it("points the control at the error and marks it invalid", () => {
    const html = render({ error: "Sai", hint: "Gợi ý" });
    expect(html).toContain('<input id="f" aria-describedby="f-error" aria-invalid="true"/>');
    expect(html).toContain('id="f-error"');
  });

  it("points the control at the hint when there is no error", () => {
    expect(render({ hint: "Gợi ý" })).toContain(
      '<input id="f" aria-describedby="f-hint"/>',
    );
  });

  it("leaves a bare control alone", () => {
    expect(render({})).toContain('<input id="f"/>');
  });

  it("keeps ids the control already names, without repeating ours", () => {
    const child = createElement("textarea", {
      id: "f",
      "aria-describedby": "counter f-error",
    });
    expect(render({ error: "Sai" }, child)).toContain(
      'aria-describedby="counter f-error"',
    );
  });

  it("does not touch a wrapper that is not a form control", () => {
    const child = createElement("div", null, createElement("input", { id: "f" }));
    expect(render({ error: "Sai" }, child)).toContain('<div><input id="f"/></div>');
  });
});
