import { describe, it, expect } from "vitest";
import { parseInviteCsv, CSV_TEMPLATE, MAX_PER_UPLOAD } from "@/features/admin/utils/bulkInviteCsv";

const header = "Name,Email,Role";

describe("parseInviteCsv", () => {
  it("parses a well-formed file", () => {
    const { rows, fatalError } = parseInviteCsv(
      `${header}\nPriya Sharma,priya@example.com,mentee\nRahul Verma,rahul@example.com,mentor`
    );
    expect(fatalError).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.error === null)).toBe(true);
    expect(rows[0]).toMatchObject({ full_name: "Priya Sharma", email: "priya@example.com", role: "mentee", line: 2 });
    expect(rows[1].role).toBe("mentor");
  });

  it("keeps commas inside a quoted name", () => {
    const { rows } = parseInviteCsv(`${header}\n"Sharma, Priya",priya@example.com,mentee`);
    expect(rows).toHaveLength(1);
    expect(rows[0].full_name).toBe("Sharma, Priya");
    expect(rows[0].error).toBeNull();
  });

  it("handles the UTF-8 BOM Excel writes", () => {
    const bom = String.fromCharCode(0xfeff);
    const { rows, fatalError } = parseInviteCsv(`${bom}${header}\nPriya,priya@example.com,mentee`);
    expect(fatalError).toBeNull();
    expect(rows[0].error).toBeNull();
    expect(rows[0].email).toBe("priya@example.com");
  });

  it("handles CRLF line endings", () => {
    const { rows } = parseInviteCsv(`${header}\r\nPriya,priya@example.com,mentee\r\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0].error).toBeNull();
  });

  it("normalises header case and email case", () => {
    const { rows, fatalError } = parseInviteCsv("NAME,EMAIL,ROLE\nPriya,Priya@Example.COM,Mentee");
    expect(fatalError).toBeNull();
    expect(rows[0].email).toBe("priya@example.com");
    expect(rows[0].role).toBe("mentee");
  });

  it("rejects a file missing a required column", () => {
    const { fatalError } = parseInviteCsv("Name,Email\nPriya,priya@example.com");
    expect(fatalError).toMatch(/role/i);
  });

  it("rejects a file with no data rows", () => {
    const { fatalError } = parseInviteCsv(header);
    expect(fatalError).toMatch(/no data rows/i);
  });

  it("flags the admin role rather than accepting it", () => {
    const { rows } = parseInviteCsv(`${header}\nEve,eve@example.com,admin`);
    expect(rows[0].error).toMatch(/mentee or mentor/i);
    expect(rows[0].role).toBeNull();
  });

  it("flags invalid emails and missing fields", () => {
    const { rows } = parseInviteCsv(`${header}\nPriya,not-an-email,mentee\n,rahul@example.com,mentor`);
    expect(rows[0].error).toMatch(/invalid email/i);
    expect(rows[1].error).toMatch(/name is required/i);
  });

  it("flags duplicate emails within the file, keeping the first", () => {
    const { rows } = parseInviteCsv(
      `${header}\nPriya,dupe@example.com,mentee\nRahul,DUPE@example.com,mentor`
    );
    expect(rows[0].error).toBeNull();
    expect(rows[1].error).toMatch(/duplicate/i);
  });

  it("skips blank lines without counting them as rows", () => {
    const { rows } = parseInviteCsv(`${header}\nPriya,priya@example.com,mentee\n\n\n`);
    expect(rows).toHaveLength(1);
  });

  it("reports line numbers matching the spreadsheet", () => {
    const { rows } = parseInviteCsv(
      `${header}\nA,a@example.com,mentee\nB,b@example.com,mentee\nC,c@example.com,mentee`
    );
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4]);
  });

  it("parses more than the upload limit so the caller can reject it", () => {
    const many = Array.from({ length: MAX_PER_UPLOAD + 1 }, (_, i) => `User ${i},u${i}@example.com,mentee`);
    const { rows } = parseInviteCsv(`${header}\n${many.join("\n")}`);
    expect(rows).toHaveLength(MAX_PER_UPLOAD + 1);
    expect(rows.every((r) => r.error === null)).toBe(true);
  });

  it("ships a template that parses cleanly", () => {
    const { rows, fatalError } = parseInviteCsv(CSV_TEMPLATE);
    expect(fatalError).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.error === null)).toBe(true);
  });
});
