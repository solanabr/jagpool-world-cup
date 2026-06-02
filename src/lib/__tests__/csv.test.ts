import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("emits a header row and data rows joined with CRLF", () => {
    expect(toCsv(["a", "b"], [["1", "2"], ["3", "4"]])).toBe(
      "a,b\r\n1,2\r\n3,4",
    );
  });

  it("quotes values containing a comma", () => {
    expect(toCsv(["name"], [["Doe, John"]])).toBe('name\r\n"Doe, John"');
  });

  it("doubles and quotes internal double-quotes", () => {
    expect(toCsv(["q"], [['he said "hi"']])).toBe('q\r\n"he said ""hi"""');
  });

  it("quotes values containing newlines", () => {
    expect(toCsv(["x"], [["line1\nline2"]])).toBe('x\r\n"line1\nline2"');
  });

  it("renders null/undefined as empty and numbers as text", () => {
    expect(toCsv(["a", "b", "c"], [[null, undefined, 42]])).toBe("a,b,c\r\n,,42");
  });

  it("does not quote plain values", () => {
    expect(toCsv(["wallet"], [["F5gwjNcRRRsT"]])).toBe("wallet\r\nF5gwjNcRRRsT");
  });
});
