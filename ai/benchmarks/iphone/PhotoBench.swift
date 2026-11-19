import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Darwin

@main struct PhotoBench: App {
    var body: some Scene { WindowGroup { BenchView() } }
}

struct BenchView: View {
    private let runtime = VisionRuntime()
    @State private var prompt = "Identify the garment and its main color."
    @State private var report = "Install the base model from Files, then select a garment photo."
    @State private var importing = false
    @State private var busy = false
    @State private var photo: PhotosPickerItem?
    var body: some View {
        Form {
            Section("SmolVLM2 base model") {
                Button("Install verified model from Files") { importing = true }
                PhotosPicker("Choose garment photo", selection: $photo, matching: .images)
                TextField("Question", text: $prompt)
                Button("Run local benchmark") { Task { await benchmark() } }.disabled(photo == nil)
            }.disabled(busy)
            if busy { Button("Cancel inference") { Task { try? await runtime.cancel() } } }
            Text(report).textSelection(.enabled)
        }.fileImporter(isPresented: $importing, allowedContentTypes: [.data]) { result in
            Task {
                busy = true
                defer { busy = false }
                do {
                    let url = try result.get()
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    try await runtime.install(url)
                    report = "Verified and installed. Select a garment photo."
                } catch { report = error.localizedDescription }
            }
        }
    }

    @MainActor private func benchmark() async {
        guard !busy, let photo else { return }
        busy = true
        defer { busy = false }
        do {
            guard let data = try await photo.loadTransferable(type: Data.self),
                  let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.85) else { throw VisionError.input }
            let uri = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            defer { try? FileManager.default.removeItem(at: uri) }
            try jpeg.write(to: uri, options: .atomic)
            let start = ProcessInfo.processInfo.systemUptime
            try await runtime.initialize()
            let loaded = ProcessInfo.processInfo.systemUptime
            let answer = try await runtime.answer(prompt, photo: uri)
            let elapsed = ProcessInfo.processInfo.systemUptime - loaded
            var usage = rusage()
            getrusage(RUSAGE_SELF, &usage)
            report = String(format: "Init %.2fs · Inference %.2fs · Peak process RSS %.0f MiB\n%@",
                            loaded - start, elapsed, Double(usage.ru_maxrss) / 1048576, answer)
        } catch { report = error.localizedDescription }
    }
}
