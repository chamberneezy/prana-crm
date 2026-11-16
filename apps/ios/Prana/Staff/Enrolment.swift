import PDFKit
import PranaKit
import SwiftUI
import UniformTypeIdentifiers
import Vision
import VisionKit

/**
 * Novi član: photograph the upisnica, import a PDF or image, or type it in. The text is recognised on the iPhone
 * (Vision, or the PDF's own text layer), read by the same parser as the web, and always reviewed before saving.
 */
struct EnrolmentFlow: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var scanning = false
    @State private var importing = false
    @State private var working = false
    @State private var failure: String?
    @State private var review: ReviewDraft?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    PageTitle(title: "Novi član")
                    Text("Kako želite upisati člana?").font(.ui(15)).foregroundStyle(DS.inkMuted)
                    option("Fotografiraj upisnicu", "Kamera prepozna list i tekst.", "camera.viewfinder", primary: true) { scanning = true }
                        .disabled(!VNDocumentCameraViewController.isSupported)
                    option("Uvezi PDF ili sliku", "PDF, JPG, PNG ili HEIC.", "doc.badge.arrow.up") { importing = true }
                    option("Upiši ručno", "Prazna upisnica.", "square.and.pencil") { review = ReviewDraft(input: MemberInput(signedDate: model.time.today())) }
                    if let failure { NoticeView(message: failure) }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Savjet").font(.ui(13, .semibold))
                        Text("Položite upisnicu na ravnu, tamniju podlogu. Neka cijeli list stane u kadar. Dnevno svjetlo, bez sjene preko teksta.").font(.ui(13)).foregroundStyle(DS.inkMuted)
                    }
                    .card()
                    Text("Prepoznavanje teksta radi na Vašem iPhoneu. Podaci ne odlaze na vanjske servere.").font(.ui(12)).foregroundStyle(DS.muted)
                }
                .padding(.horizontal, DS.gutter)
                .padding(.bottom, 32)
            }
            .linenBackground()
            .overlay { if working { ProgressView("Čitanje teksta…").padding(24).glassSurface(in: RoundedRectangle(cornerRadius: 16)) } }
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Odustani") { dismiss() } } }
            .navigationDestination(item: $review) { draft in
                MemberFormView(mode: .create(draft)) { dismiss() }
            }
        }
        .fullScreenCover(isPresented: $scanning) {
            DocumentScanner { images in
                scanning = false
                Task { await recognise(images: images) }
            } cancel: { scanning = false }
                .ignoresSafeArea()
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .jpeg, .png, .heic]) { result in
            if case let .success(url) = result { Task { await recognise(file: url) } }
        }
    }

    private func option(_ title: String, _ subtitle: String, _ icon: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.system(size: 24, weight: .light)).frame(width: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.ui(16, .semibold))
                    Text(subtitle).font(.ui(13)).opacity(0.75)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold)).opacity(0.5)
            }
            .foregroundStyle(primary ? DS.white : DS.ink)
            .padding(18)
            .frame(maxWidth: .infinity)
            .background(primary ? DS.ink : DS.white, in: RoundedRectangle(cornerRadius: DS.radius))
            .overlay(RoundedRectangle(cornerRadius: DS.radius).strokeBorder(primary ? .clear : DS.line))
        }
        .buttonStyle(.plain)
    }

    private func recognise(images: [UIImage]) async {
        working = true
        defer { working = false }
        guard let first = images.first, let jpeg = first.jpegData(compressionQuality: 0.85) else { return }
        let lines = await Recognition.lines(in: first)
        finish(lines: lines, file: (jpeg, "upisnica.jpg", "image/jpeg", .camera), source: "vision")
    }

    private func recognise(file url: URL) async {
        working = true
        defer { working = false }
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else { failure = "Datoteka se nije mogla otvoriti. Pokušajte s drugom."; return }
        guard data.count <= 20 * 1024 * 1024 else { failure = "Datoteka je veća od 20 MB."; return }
        let type = UTType(filenameExtension: url.pathExtension) ?? .data
        if type.conforms(to: .pdf), let pdf = PDFDocument(data: data), let page = pdf.page(at: 0) {
            var lines = Recognition.textLayer(of: page)
            var source = "pdf-text"
            // A scanned PDF has no text layer: render the page and recognise it.
            if lines.isEmpty, let image = Recognition.render(page) {
                lines = await Recognition.lines(in: image)
                source = "vision"
            }
            finish(lines: lines, file: (data, url.lastPathComponent, "application/pdf", .pdf), source: source)
        } else if let image = UIImage(data: data) {
            let lines = await Recognition.lines(in: image)
            let mime = type.conforms(to: .png) ? "image/png" : (type.conforms(to: .heic) ? "image/heic" : "image/jpeg")
            finish(lines: lines, file: (data, url.lastPathComponent, mime, .image), source: "vision")
        } else {
            failure = "Odaberite PDF, JPG, PNG ili HEIC datoteku."
        }
    }

    private func finish(lines: [ScanLine], file: (Data, String, String, DocumentSource), source: String) {
        let scan = parseUpisnica(lines)
        var input = MemberInput(signedDate: model.time.today())
        let words = scan.name.split(separator: " ")
        input.firstName = words.first.map(String.init) ?? ""
        input.lastName = words.dropFirst().joined(separator: " ")
        input.email = scan.email
        input.phone = scan.phone
        input.dob = isoDate(scan.dob)
        input.isStudentOrRetired = scan.student
        input.healthFlag = scan.health
        input.healthText = scan.healthText
        input.consentAccuracy = scan.consent
        input.consentNews = scan.news
        if !scan.place.isEmpty { input.signedPlace = scan.place }
        if let date = isoDate(scan.date) { input.signedDate = date }
        review = ReviewDraft(input: input, planCode: scan.plan.rawValue, needsReview: Set(scan.needsReview), file: file, recognition: RecognitionRecord(source: source, lines: lines, scan: scan))
    }

    /** "02.11.1979." → "1979-11-02". */
    private func isoDate(_ display: String) -> String? {
        let p = display.split(separator: ".").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return String(format: "%04d-%02d-%02d", p[2], p[1], p[0])
    }
}

/** What the review form starts from: typed in, or read from a form. */
struct ReviewDraft: Identifiable, Hashable {
    let id = UUID()
    var input: MemberInput
    var planCode: String?
    var needsReview: Set<ScanField> = []
    var file: (Data, String, String, DocumentSource)?
    var recognition: RecognitionRecord?

    static func == (a: ReviewDraft, b: ReviewDraft) -> Bool { a.id == b.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

enum Recognition {
    /** Text lines with their boxes (top-left origin, pixels) from Vision, recognised off the main thread. */
    static func lines(in image: UIImage) async -> [ScanLine] {
        guard let cgImage = image.cgImage else { return [] }
        nonisolated(unsafe) let picture = cgImage
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        return await Task.detached(priority: .userInitiated) { recognise(picture, orientation: orientation) }.value
    }

    nonisolated static func recognise(_ cgImage: CGImage, orientation: CGImagePropertyOrientation) -> [ScanLine] {
        let width = Double(cgImage.width), height = Double(cgImage.height)
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        // Croatian if this iPhone has it; otherwise Latin defaults, helped by the form's own words.
        if let supported = try? request.supportedRecognitionLanguages(), supported.contains("hr-HR") { request.recognitionLanguages = ["hr-HR"] }
        request.customWords = ["Ime i prezime", "E-mail", "Broj mobitela", "Datum rođenja", "Student / umirovljenik", "Odaberite članstvo", "tjedno", "Neograničeno", "Mjesto i datum", "Potpis", "Potvrđujem", "Želim primati obavijesti"]
        do {
            try VNImageRequestHandler(cgImage: cgImage, orientation: orientation).perform([request])
        } catch {
            return []
        }
        return (request.results ?? []).compactMap { o -> ScanLine? in
            guard let best = o.topCandidates(1).first else { return nil }
            let box = o.boundingBox
            return ScanLine(text: best.string, x: box.minX * width, y: (1 - box.maxY) * height, width: box.width * width, height: box.height * height, confidence: Double(best.confidence))
        }
    }

    /** A PDF's own text, line by line, in points from the top-left. Empty for a scanned PDF. */
    static func textLayer(of page: PDFPage) -> [ScanLine] {
        let bounds = page.bounds(for: .mediaBox)
        guard let all = page.selection(for: bounds) else { return [] }
        return all.selectionsByLine().compactMap { line in
            guard let text = line.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
            let r = line.bounds(for: page)
            return ScanLine(text: text, x: r.minX - bounds.minX, y: bounds.maxY - r.maxY, width: r.width, height: r.height)
        }
    }

    static func render(_ page: PDFPage) -> UIImage? {
        let bounds = page.bounds(for: .mediaBox)
        let size = CGSize(width: bounds.width * 2, height: bounds.height * 2)
        return page.thumbnail(of: size, for: .mediaBox)
    }
}

extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .down: self = .down
        case .left: self = .left
        case .right: self = .right
        case .upMirrored: self = .upMirrored
        case .downMirrored: self = .downMirrored
        case .leftMirrored: self = .leftMirrored
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}

/** VisionKit's document camera: edge detection and de-skew. */
struct DocumentScanner: UIViewControllerRepresentable {
    let done: ([UIImage]) -> Void
    let cancel: () -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(done: done, cancel: cancel) }

    @MainActor final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let done: ([UIImage]) -> Void
        let cancel: () -> Void
        init(done: @escaping ([UIImage]) -> Void, cancel: @escaping () -> Void) {
            self.done = done
            self.cancel = cancel
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            done((0 ..< scan.pageCount).map { scan.imageOfPage(at: $0) })
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { cancel() }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) { cancel() }
    }
}
