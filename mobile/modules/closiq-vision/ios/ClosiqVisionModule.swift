import ExpoModulesCore
import Foundation

public final class ClosiqVisionModule: Module {
    private let runtime = VisionRuntime()

    public func definition() -> ModuleDefinition {
        Name("ClosiqVision")
        AsyncFunction("status") { () async throws -> String in try await self.runtime.status() }
        AsyncFunction("install") { (uri: URL) async throws in try await self.runtime.install(uri) }
        AsyncFunction("initialize") { () async throws in try await self.runtime.initialize() }
        AsyncFunction("answer") { (text: String, uri: URL?) async throws -> String in
            try await self.runtime.answer(text, photo: uri)
        }
        AsyncFunction("cancel") { () async throws in try await self.runtime.cancel() }
        AsyncFunction("unload") { () async throws in try await self.runtime.unload() }
        AsyncFunction("remove") { () async throws in try await self.runtime.remove() }
    }
}
