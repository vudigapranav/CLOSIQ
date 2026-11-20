import Foundation
import CryptoKit
import LiteRTLM

enum VisionError: String, LocalizedError {
    case busy = "Another model operation is in progress."
    case invalid = "The model failed size or SHA-256 verification."
    case missing = "Install the verified base model first."
    case unavailable = "Initialize the model before asking a question."
    case input = "Choose a local photo and a short question."
    var errorDescription: String? { rawValue }
}

actor VisionRuntime {
    private let manager = FileManager.default
    private var engine: Engine?
    private var conversation: Conversation?
    private var busy = false
    private var cancelled = false
    private var discardWhenIdle = false
    static let revision = "307bf6d1018edd2c2d0903b92628151bdb5cc2b7"
    static let size = 363085824
    static let digest = "7b432bbc0a5c54ba15ecb2f039a7711c1cfb1fe38badec01397a076b5043f74e"

    private func destination() throws -> URL {
        var folder = try manager.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                     appropriateFor: nil, create: true).appendingPathComponent("HeyHangerModels")
        try manager.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        return folder.appendingPathComponent(Self.revision + ".litertlm")
    }

    func status() throws -> String {
        if engine != nil { return "ready" }
        return manager.fileExists(atPath: try destination().path) ? "installed" : "missing"
    }

    func install(_ url: URL) throws {
        guard !busy else { throw VisionError.busy }
        guard url.isFileURL, try url.resourceValues(forKeys: [.fileSizeKey]).fileSize == Self.size else { throw VisionError.invalid }
        let output = try destination()
        let stage = output.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".partial")
        defer { try? manager.removeItem(at: stage) }
        try manager.copyItem(at: url, to: stage)
        let handle = try FileHandle(forReadingFrom: stage)
        defer { try? handle.close() }
        var hash = SHA256()
        while let block = try handle.read(upToCount: 1024 * 1024), !block.isEmpty { hash.update(data: block) }
        guard hash.finalize().map({ String(format: "%02x", $0) }).joined() == Self.digest else { throw VisionError.invalid }
        if manager.fileExists(atPath: output.path) {
            _ = try manager.replaceItemAt(output, withItemAt: stage)
        } else {
            try manager.moveItem(at: stage, to: output)
        }
        engine = nil
    }

    func initialize() async throws {
        guard !busy else { throw VisionError.busy }
        if engine != nil { return }
        let path = try destination().path
        guard manager.fileExists(atPath: path) else { throw VisionError.missing }
        busy = true
        defer { finish() }
        let config = try EngineConfig(modelPath: path, backend: .gpu, visionBackend: .cpu(),
                                      cacheDir: NSTemporaryDirectory())
        let next = Engine(engineConfig: config)
        try await next.initialize()
        engine = next
    }

    private func finish() {
        busy = false
        conversation = nil
        cancelled = false
        if discardWhenIdle { engine = nil; discardWhenIdle = false }
    }

    func answer(_ text: String, photo: URL?) async throws -> String {
        guard !busy else { throw VisionError.busy }
        guard let engine else { throw VisionError.unavailable }
        guard !text.isEmpty, text.count <= 2400 else { throw VisionError.input }
        var contents: [Content] = []
        if let photo {
            guard photo.isFileURL, manager.isReadableFile(atPath: photo.path) else { throw VisionError.input }
            contents.append(.imageFile(photo.path))
        }
        contents.append(.text(text))
        busy = true
        defer { finish() }
        let chat = try await engine.createConversation()
        conversation = chat
        if cancelled { throw CancellationError() }
        var answer = ""
        for try await chunk in chat.sendMessageStream(Message(contents: contents)) {
            if cancelled { throw CancellationError() }
            answer += chunk.toString
            if answer.count >= 1600 { try chat.cancel(); break }
        }
        return answer
    }

    func cancel() throws {
        if busy { cancelled = true; try conversation?.cancel() }
    }

    func unload() throws {
        if busy { discardWhenIdle = true; try cancel() } else { engine = nil }
    }

    func remove() throws {
        guard !busy else { throw VisionError.busy }
        engine = nil
        let url = try destination()
        if manager.fileExists(atPath: url.path) { try manager.removeItem(at: url) }
    }
}
