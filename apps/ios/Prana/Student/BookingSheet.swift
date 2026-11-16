import PranaKit
import SwiftUI

/**
 * Signing up for a class: first and last name, as on the upisnica. Only members of the studio match; there is no
 * account and no limit. The name is remembered on this phone if wanted.
 */
struct BookingSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let session: PublicSession

    @AppStorage("student.firstName") private var savedFirst = ""
    @AppStorage("student.lastName") private var savedLast = ""
    @AppStorage("student.remember") private var remember = true
    @State private var first = ""
    @State private var last = ""
    @State private var sending = false
    @State private var failure: String?
    @FocusState private var focus: Field?
    enum Field { case first, last }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 12) {
                        ClassPill(color: session.colorToken, width: 10)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.offeringName).font(.ui(16, .semibold))
                            Text(model.time.shortMoment(session.startsAt)).font(.ui(14)).foregroundStyle(DS.inkMuted)
                        }
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    TextField("Ime", text: $first)
                        .textContentType(.givenName)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .first)
                        .submitLabel(.next)
                        .onSubmit { focus = .last }
                    TextField("Prezime", text: $last)
                        .textContentType(.familyName)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($focus, equals: .last)
                        .submitLabel(.go)
                        .onSubmit { Task { await send() } }
                } footer: {
                    Text("Upišite ime i prezime kao na upisnici. Prijaviti se mogu samo članovi studija.")
                }
                Section {
                    Toggle("Zapamti me na ovom uređaju", isOn: $remember).tint(DS.sageDeep)
                }
                if let failure {
                    Section { NoticeView(message: failure).listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
                }
            }
            .font(.ui(16))
            .linenBackground()
            .navigationTitle("Prijava na sat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Prijavi se") { Task { await send() } }
                        .disabled(sending || first.trimmed.isEmpty || last.trimmed.isEmpty)
                        .glassButton(prominent: true)
                }
            }
            .overlay { if sending { ProgressView().controlSize(.large) } }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(DS.linen)
        .onAppear {
            first = savedFirst
            last = savedLast
            focus = first.isEmpty ? .first : nil
        }
        .sensoryFeedback(.error, trigger: failure) { _, new in new != nil }
    }

    private func send() async {
        guard !first.trimmed.isEmpty, !last.trimmed.isEmpty, !sending else { return }
        sending = true
        failure = nil
        defer { sending = false }
        do {
            let receipt = try await model.api.book(sessionID: session.id, firstName: first, lastName: last)
            let name = "\(first.trimmed) \(last.trimmed)"
            model.bookings.add(SavedBooking(receipt: receipt, session: session, personName: name))
            model.bookingsChanged()
            if remember {
                savedFirst = first.trimmed
                savedLast = last.trimmed
            } else {
                savedFirst = ""
                savedLast = ""
            }
            model.show("Prijavljeni ste: \(session.offeringName), \(model.time.shortMoment(session.startsAt))")
            dismiss()
        } catch {
            failure = error.message
        }
    }
}

/** The phone's own sign-ups, soonest first, each with "Odjavi". */
struct MyBookingsView: View {
    @Environment(AppModel.self) private var model
    @State private var cancelling: SavedBooking?

    var body: some View {
        let bookings = { _ = model.bookingsVersion; return model.bookings.upcoming() }()
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    StudioHeader()
                    PageTitle(title: "Moje prijave")
                    if bookings.isEmpty {
                        EmptyStateView(title: "Još se niste prijavili ni na jedan sat", message: "Odaberite sat u rasporedu i dodirnite „Prijavi se“.", systemImage: "calendar.badge.plus")
                    }
                    ForEach(bookings) { booking in
                        HStack(spacing: 12) {
                            ClassPill(color: booking.colorToken, width: 10)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(booking.offeringName).font(.ui(16, .semibold))
                                Text(model.time.shortMoment(booking.startsAt)).font(.ui(14)).foregroundStyle(DS.inkMuted)
                                Text(booking.personName).font(.ui(13)).foregroundStyle(DS.muted)
                            }
                            Spacer()
                            Button("Odjavi") { cancelling = booking }.buttonStyle(.ds(.ghost, compact: true))
                        }
                        .card()
                    }
                    Text("Prijave se čuvaju samo na ovom uređaju. Ako se ne možete odjaviti, javite se studiju.")
                        .font(.ui(12)).foregroundStyle(DS.muted)
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .toolbar(.hidden, for: .navigationBar)
        }
        .confirmationDialog("Odjaviti se sa sata?", isPresented: Binding(get: { cancelling != nil }, set: { if !$0 { cancelling = nil } }), titleVisibility: .visible, presenting: cancelling) { booking in
            Button("Odjavi \(booking.personName)", role: .destructive) { Task { await cancel(booking) } }
        }
    }

    private func cancel(_ booking: SavedBooking) async {
        do {
            try await model.api.cancelBooking(id: booking.id, cancelToken: booking.cancelToken)
        } catch let error as PranaError where error.code == "not_found" {
        } catch {
            model.show(error.message, systemImage: "exclamationmark.circle")
            return
        }
        model.bookings.remove(id: booking.id)
        model.bookingsChanged()
        model.show("Odjavljeni ste: \(booking.offeringName)")
    }
}
