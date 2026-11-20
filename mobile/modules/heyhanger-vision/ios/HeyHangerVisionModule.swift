import ExpoModulesCore
import Foundation

public final class HeyHangerVisionModule: Module {
    private let vision = VisionRuntime()

    public func definition() -> ModuleDefinition {
        Name("HeyHangerVision")
        AsyncFunction("status") { () async throws -> String in try await self.vision.status() }
        AsyncFunction("install") { (uri: URL) async throws in try await self.vision.install(uri) }
        AsyncFunction("initialize") { () async throws in try await self.vision.initialize() }
        AsyncFunction("answer") { (text: String, uri: URL?) async throws -> String in
            try await self.vision.answer(text, photo: uri)
        }
        AsyncFunction("cancel") { () async throws in try await self.vision.cancel() }
        AsyncFunction("unload") { () async throws in try await self.vision.unload() }
        AsyncFunction("remove") { () async throws in try await self.vision.remove() }
    }
}
