import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

describe("Button interaction contract", () => {
  it("renders action buttons as type button by default", () => {
    expect(renderToStaticMarkup(<Button>Atualizar</Button>)).toContain('type="button"');
  });

  it("does not put button type on link children", () => {
    const html = renderToStaticMarkup(<Button asChild><a href="/fila">Fila</a></Button>);
    expect(html).toContain('href="/fila"');
    expect(html).not.toContain('type="button"');
  });
});
