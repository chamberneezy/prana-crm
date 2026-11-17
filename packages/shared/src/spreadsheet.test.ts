import { describe, expect, it } from 'vitest';
import { membersFromTable, parseCsv, readDate, readTable, SpreadsheetError } from './spreadsheet';

async function deflate(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(raw)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal zip, deflated like Excel writes it. */
async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const out: number[] = [];
  const central: number[] = [];
  const u16 = (to: number[], n: number) => to.push(n & 0xff, (n >> 8) & 0xff);
  const u32 = (to: number[], n: number) => to.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
  const zeros = (to: number[], n: number) => to.push(...new Array<number>(n).fill(0));
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = new TextEncoder().encode(name);
    const raw = new TextEncoder().encode(text);
    const data = await deflate(raw);
    const offset = out.length;
    u32(out, 0x04034b50);
    zeros(out, 4);
    u16(out, 8);
    zeros(out, 8);
    u32(out, data.length);
    u32(out, raw.length);
    u16(out, nameBytes.length);
    u16(out, 0);
    out.push(...nameBytes, ...data);
    u32(central, 0x02014b50);
    zeros(central, 6);
    u16(central, 8);
    zeros(central, 8);
    u32(central, data.length);
    u32(central, raw.length);
    u16(central, nameBytes.length);
    zeros(central, 12);
    u32(central, offset);
    central.push(...nameBytes);
  }
  const directoryAt = out.length;
  out.push(...central);
  const count = Object.keys(files).length;
  u32(out, 0x06054b50);
  zeros(out, 4);
  u16(out, count);
  u16(out, count);
  u32(out, central.length);
  u32(out, directoryAt);
  u16(out, 0);
  return new Uint8Array(out);
}

const xlsx = await zip({
  'xl/workbook.xml': '<workbook><sheets><sheet name="Članovi" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Ime i prezime</t></si><si><t>E-mail</t></si><si><t>Datum rođenja</t></si><si><r><t>Ana </t></r><r><t>Horvat</t></r></si><si><t>ana@example.com</t></si></sst>',
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
    '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" s="1"><v>29161</v></c></row>' +
    '<row r="4"><c r="A4" t="inlineStr"><is><t>Ivo Đurić &amp; sin</t></is></c><c r="C4" t="str"><v>02.11.1979.</v></c></row>' +
    '</sheetData></worksheet>',
});

describe('spreadsheets', () => {
  it('reads CSV with semicolons, quotes and a BOM', async () => {
    const csv = '﻿Ime;Prezime;Mobitel;Napomena\r\nAna;Horvat;091 123 4567;"leđa; oprez"\r\n;;;\r\nIvo;Kovač;;"rekao ""bok"""\r\n';
    const table = await readTable(new TextEncoder().encode(csv));
    expect(table[0]).toEqual(['Ime', 'Prezime', 'Mobitel', 'Napomena']);
    const { rows, columns } = membersFromTable(table);
    expect(columns.map((c) => c.field)).toEqual(['first_name', 'last_name', 'phone', 'notes']);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      line: 2,
      first_name: 'Ana',
      last_name: 'Horvat',
      phone: '091 123 4567',
      notes: 'leđa; oprez',
    });
    expect(rows[1]).toMatchObject({
      line: 4,
      first_name: 'Ivo',
      last_name: 'Kovač',
      notes: 'rekao "bok"',
    });
  });

  it('reads CSV saved by Croatian Excel in Windows-1250', async () => {
    // "Ime i prezime\nŠime Čulić" in Windows-1250.
    const bytes = new Uint8Array([...new TextEncoder().encode('Ime i prezime\n'), 0x8a, ...new TextEncoder().encode('ime '), 0xc8, ...new TextEncoder().encode('uli'), 0xe6]);
    const { rows } = membersFromTable(await readTable(bytes));
    expect(rows[0]).toMatchObject({ first_name: 'Šime', last_name: 'Čulić' });
  });

  it('reads the first sheet of an .xlsx, shared and inline strings and Excel dates', async () => {
    const { rows } = membersFromTable(await readTable(xlsx));
    expect(rows).toEqual([
      expect.objectContaining({
        line: 2,
        first_name: 'Ana',
        last_name: 'Horvat',
        email: 'ana@example.com',
        dob: '1979-11-02',
      }),
      expect.objectContaining({
        line: 4,
        first_name: 'Ivo',
        last_name: 'Đurić & sin',
        email: null,
        dob: '1979-11-02',
      }),
    ]);
  });

  it('says which files it cannot read', async () => {
    await expect(readTable(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).rejects.toThrow(new SpreadsheetError('old_excel'));
    await expect(readTable(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).rejects.toThrow(SpreadsheetError);
    expect(() => membersFromTable(parseCsv('Datum,Iznos\n1.1.2026,30'))).toThrow(new SpreadsheetError('no_name_column'));
  });

  it('finds the header below a title, marks unreadable cells and reads yes/no', () => {
    const { rows } = membersFromTable(
      parseCsv('Popis članova 2026\n\nIme i prezime,Email,Datum rođenja,Student/umirovljenik,Član od\nMaja Perić,nije-mail,32.13.1990,DA,1.9.2025\nLuka,luka@example.com,,,'),
    );
    expect(rows[0]).toMatchObject({
      first_name: 'Maja',
      last_name: 'Perić',
      email: null,
      dob: null,
      is_student_or_retired: true,
      member_since: '2025-09-01',
      problems: ['email', 'dob'],
    });
    expect(rows[1]).toMatchObject({
      first_name: 'Luka',
      last_name: '',
      is_student_or_retired: false,
      problems: [],
    });
  });

  it('reads the date forms people type', () => {
    expect(readDate('2.11.1979.')).toBe('1979-11-02');
    expect(readDate('02/11/1979')).toBe('1979-11-02');
    expect(readDate('1979-11-02')).toBe('1979-11-02');
    expect(readDate('2.11.79')).toBe('1979-11-02');
    expect(readDate('31.2.2000')).toBeNull();
    expect(readDate('sutra')).toBeNull();
  });
});
