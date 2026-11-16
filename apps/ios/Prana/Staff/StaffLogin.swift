import PranaKit
import SwiftUI

/** The hidden staff sign-in: e-mail and password, for addresses on the studio's staff list only. */
struct StaffLoginSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 10) {
                        Image("Logo").resizable().scaledToFit().frame(width: 64, height: 56)
                        Text("Prijava").font(.display(26))
                        Text("Samo za osoblje studija.").font(.ui(14)).foregroundStyle(DS.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                Section {
                    TextField("E-mail", text: $email)
                        .textContentType(.username)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Lozinka", text: $password)
                        .textContentType(.password)
                        .onSubmit { Task { await signIn() } }
                }
                if let failure {
                    Section { NoticeView(message: failure).listRowInsets(EdgeInsets()).listRowBackground(Color.clear) }
                }
                Section {
                    Button {
                        Task { await signIn() }
                    } label: {
                        if busy { ProgressView().tint(.white) } else { Text("Prijava") }
                    }
                    .buttonStyle(.ds(.primary, fullWidth: true))
                    .disabled(busy || email.isEmpty || password.isEmpty)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .font(.ui(16))
            .linenBackground()
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } } }
        }
        .presentationBackground(DS.linen)
        .interactiveDismissDisabled(busy)
    }

    private func signIn() async {
        guard !busy else { return }
        busy = true
        failure = nil
        defer { busy = false }
        do {
            try await model.signIn(email: email, password: password)
            dismiss()
            model.show("Prijavljeni ste kao \(model.me?.staff.name ?? email).")
        } catch {
            failure = error.message
        }
    }
}
