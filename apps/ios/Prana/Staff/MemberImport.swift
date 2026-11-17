import PranaKit
import SwiftUI
import UniformTypeIdentifiers

/** The files "Uvezi popis članova" offers: CSV, tab-separated text and Excel (.xlsx; an old .xls gets a clear message). */
enum MemberListFile {
    static let types: [UTType] = [
        .commaSeparatedText, .tabSeparatedText, .plainText, .spreadsheet,
        UTType("org.openxmlformats.spreadsheetml.sheet"), UTType("com.microsoft.excel.xls"),
    ].compactMap(\.self)
}

/**
 * Members from a CSV or Excel file: the API reads it, this shows who was found (and who is already a member, so not
 * added again), and the members are added together once the person importing confirms everyone signed an upisnica.
 */
struct MemberImportView: View {
    @Environment(AppModel.self) private var model
    let filename: String
    let preview: ImportPreview
    let done: () -> Void

    @State private var confirmed = false
    @State private var saving = false
    @State private var failure: String?

    private var newRows: [ImportRow] { preview.rows.filter { !$0.duplicate } }
    private var duplicates: Int { preview.rows.count - newRows.count }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PageTitle(title: "Uvoz članova")
                VStack(alignment: .leading, spacing: 6) {
                    Label(filename, systemImage: "tablecells").font(.ui(15, .semibold)).foregroundStyle(DS.ink)
                    Text(summary).font(.ui(14)).foregroundStyle(DS.inkMuted)
                    if !preview.columns.isEmpty {
                        Text("Stupci: " + preview.columns.map { "\($0.header) → \(label($0.field))" }.joined(separator: ", "))
                            .font(.ui(12)).foregroundStyle(DS.muted)
                    }
                }
                .card()

                if preview.rows.isEmpty {
                    NoticeView(message: "U tablici nema nijednog reda s imenom ispod naslova stupaca.")
                } else {
                    VStack(spacing: 0) {
                        ForEach(preview.rows) { row in
                            rowView(row)
                            if row.id != preview.rows.last?.id { Divider().overlay(DS.lineSoft) }
                        }
                    }
                    .background(DS.white, in: RoundedRectangle(cornerRadius: DS.radius))
                    .overlay(RoundedRectangle(cornerRadius: DS.radius).strokeBorder(DS.line))
                }

                if !newRows.isEmpty {
                    Toggle("Svi ovi članovi potpisali su upisnicu i potvrdili točnost podataka", isOn: $confirmed)
                        .font(.ui(15))
                        .tint(DS.sageDeep)
                        .card()
                }
                if let failure { NoticeView(message: failure) }
            }
            .padding(.horizontal, DS.gutter)
            .padding(.bottom, 110)
        }
        .linenBackground()
        .safeAreaInset(edge: .bottom) {
            if !newRows.isEmpty {
                Button(saving ? "Dodajem…" : "Dodaj \(members(newRows.count))") { Task { await save() } }
                    .buttonStyle(.ds(.primary, fullWidth: true))
                    .disabled(!confirmed || saving)
                    .padding(.horizontal, DS.gutter)
                    .padding(.vertical, 12)
                    .background(.bar)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private var summary: String {
        var parts = ["Pronađeno: \(members(preview.rows.count))"]
        if duplicates > 0 { parts.append("\(duplicates) već postoji ili se ponavlja, ne dodaje se ponovno") }
        return parts.joined(separator: " · ")
    }

    private func rowView(_ row: ImportRow) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Avatar(name: row.fullName)
            VStack(alignment: .leading, spacing: 3) {
                Text(row.fullName).font(.ui(15, .semibold)).foregroundStyle(row.duplicate ? DS.muted : DS.ink)
                let details = [row.email, row.phone, row.dob.map(displayDate)].compactMap(\.self)
                if !details.isEmpty { Text(details.joined(separator: " · ")).font(.ui(13)).foregroundStyle(DS.inkMuted) }
                HStack(spacing: 6) {
                    if row.duplicate { TagView("Već upisan/a") }
                    if row.isStudentOrRetired { TagView("Student / umirovljenik", kind: .plan) }
                    if !row.problems.isEmpty { TagView("Nečitljivo: " + row.problems.map(label).joined(separator: ", "), kind: .health) }
                }
            }
            Spacer(minLength: 0)
            Text("red \(row.line)").font(.ui(11)).foregroundStyle(DS.muted)
        }
        .padding(12)
        .opacity(row.duplicate ? 0.7 : 1)
        .accessibilityElement(children: .combine)
    }

    private func save() async {
        saving = true
        defer { saving = false }
        do {
            let result = try await model.api.importMembers(preview.rows)
            model.show(result.skipped > 0 ? "Dodano: \(members(result.created)). Preskočeno: \(result.skipped)." : "Dodano: \(members(result.created)).")
            done()
        } catch {
            failure = error.message
        }
    }

    private func members(_ n: Int) -> String {
        let word = n % 10 == 1 && n % 100 != 11 ? "člana" : "članova"
        return "\(n) \(word)"
    }

    private func label(_ field: String) -> String {
        switch field {
        case "full_name": "ime i prezime"
        case "first_name": "ime"
        case "last_name": "prezime"
        case "email": "e-mail"
        case "phone": "mobitel"
        case "dob": "datum rođenja"
        case "is_student_or_retired": "student / umirovljenik"
        case "member_since": "član od"
        case "notes": "napomena"
        default: field
        }
    }

    /** "1979-11-02" → "2. 11. 1979." */
    private func displayDate(_ iso: String) -> String {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        return p.count == 3 ? "\(p[2]). \(p[1]). \(p[0])." : iso
    }
}
