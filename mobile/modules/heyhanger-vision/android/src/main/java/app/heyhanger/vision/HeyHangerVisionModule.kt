package app.heyhanger.vision

import android.content.ComponentCallbacks2
import android.content.res.Configuration
import android.net.Uri
import android.os.Debug
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import android.system.Os
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.collect
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.locks.ReentrantLock


class HeyHangerVisionModule : Module() {
  private val lock = ReentrantLock()
  private val sessionLock = Any()
  private var active: Conversation? = null
  @Volatile private var engine: Engine? = null
  @Volatile private var discardAfterRun = false
  private val context get() = requireNotNull(appContext.reactContext)
  private val model get() = File(context.noBackupFilesDir, "307bf6d1018edd2c2d0903b92628151bdb5cc2b7.litertlm")
  // Written before the native engine starts and removed when it returns or
  // throws. If it is still there, the process died inside the engine (for
  // example SIGILL on a CPU the runtime's kernels do not support), which no
  // Kotlin catch can intercept. Status then reports "failed" so the app stops
  // starting the engine automatically instead of crashing on every scan.
  private val loading get() = File(context.noBackupFilesDir, "heyhanger-engine-loading")

  private fun localFile(uri: String): File {
    val path = Uri.parse(uri)
    require(path.scheme == "file") { "Choose a local file." }
    return File(requireNotNull(path.path))
  }

  private fun <T> exclusive(block: () -> T): T {
    check(lock.tryLock()) { "Another model operation is in progress." }
    try { return block() }
    finally {
      if (discardAfterRun) { engine?.close(); engine = null; discardAfterRun = false }
      lock.unlock()
    }
  }

  private fun cancel() = synchronized(sessionLock) { active?.cancelProcess(); Unit }

  private fun release() {
    discardAfterRun = true
    cancel()
    if (lock.tryLock()) {
      try { engine?.close(); engine = null; discardAfterRun = false } finally { lock.unlock() }
    }
  }

  private val pressure = object : ComponentCallbacks2 {
    override fun onConfigurationChanged(config: Configuration) {}
    override fun onLowMemory() { release() }
    override fun onTrimMemory(level: Int) {
      if (level == ComponentCallbacks2.TRIM_MEMORY_RUNNING_CRITICAL || level >= ComponentCallbacks2.TRIM_MEMORY_BACKGROUND) release()
    }
  }

  private fun load(gpu: Boolean) {
    if (engine != null) return
    check(model.isFile) { "Install the base model first." }
    check(android.os.Build.SUPPORTED_ABIS.contains("arm64-v8a")) { "This runtime requires an ARM64 Android phone." }
    check(!loading.exists()) { "The AI model closed the app while starting on this phone. Scans use manual entry; styling uses wardrobe rules." }
    val backend = if (gpu) Backend.GPU() else Backend.CPU()
    loading.writeText(if (gpu) "gpu" else "cpu")
    val next = Engine(EngineConfig(modelPath = model.path, backend = backend, visionBackend = backend,
      maxNumTokens = 1024, maxNumImages = 1, cacheDir = context.cacheDir.path))
    try { next.initialize(); engine = next } catch (error: Throwable) { next.close(); throw error }
    finally { loading.delete() }
  }

  override fun definition() = ModuleDefinition {
    Name("HeyHangerVision")
    AsyncFunction("status") {
      if (engine != null) "ready" else if (!model.isFile) "missing" else if (loading.exists()) "failed" else "installed"
    }
    AsyncFunction("resetLoadFailure") { loading.delete(); Unit }
    AsyncFunction("memoryKiB") { Debug.getPss().toDouble() }
    AsyncFunction("install") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        exclusive {
          val input = localFile(uri)
          require(input.length() == 363085824L) { "Incorrect model size." }
          val stage = File(model.parentFile, "heyhanger-model.partial")
          try {
            val digest = MessageDigest.getInstance("SHA-256")
            input.inputStream().buffered().use { source ->
              stage.outputStream().buffered().use { out ->
                val buffer = ByteArray(1024 * 1024)
                while (true) {
                  val count = source.read(buffer)
                  if (count < 0) break
                  digest.update(buffer, 0, count)
                  out.write(buffer, 0, count)
                }
              }
            }
            val hex = digest.digest().joinToString("") { "%02x".format(it) }
            require(hex == "7b432bbc0a5c54ba15ecb2f039a7711c1cfb1fe38badec01397a076b5043f74e") { "Model checksum mismatch." }
            Os.rename(stage.absolutePath, model.absolutePath)
            engine?.close()
            engine = null
            loading.delete()
          } finally { stage.delete() }
        }
      }
    }
    AsyncFunction("initialize") Coroutine { ->
      withContext(Dispatchers.IO) { exclusive { load(false) } }
    }
    AsyncFunction("initializeBackend") Coroutine { gpu: Boolean ->
      withContext(Dispatchers.IO) {
        exclusive { engine?.close(); engine = null; load(gpu) }
      }
    }
    AsyncFunction("answer") Coroutine { prompt: String, photo: String? ->
      withContext(Dispatchers.IO) {
        exclusive {
          require(prompt.length in 1..2400) { "Choose a short prompt." }
          val contents = if (photo == null) Contents.of(Content.Text(prompt)) else {
            val image = localFile(photo)
            require(image.isFile) { "The photo is missing." }
            Contents.of(Content.ImageFile(image.path), Content.Text(prompt))
          }
          checkNotNull(engine) { "Initialize the model first." }.createConversation().use { chat ->
            synchronized(sessionLock) { active = chat }
            val response = StringBuilder()
            var capped = false
            try {
              runBlocking {
                chat.sendMessageAsync(contents).collect { part ->
                  response.append(part.toString())
                  // Answers are a few short lines; stop a model that keeps going.
                  if (!capped && response.length > 700) { capped = true; chat.cancelProcess() }
                }
              }
              response.toString()
            } catch (stopped: java.util.concurrent.CancellationException) {
              // cancelProcess() ends the stream with a CancellationException.
              // When HeyHanger stopped it for length, the text so far is the answer;
              // a user/background cancel is still reported as cancelled.
              if (capped) response.toString() else throw stopped
            }
            finally { synchronized(sessionLock) { active = null } }
          }
        }
      }
    }
    AsyncFunction("cancel") { cancel() }
    AsyncFunction("unload") { release() }
    AsyncFunction("remove") {
      exclusive { engine?.close(); engine = null; loading.delete(); check(!model.exists() || model.delete()) { "Could not delete model." } }
    }
    OnActivityEntersBackground { release() }
    OnCreate { context.registerComponentCallbacks(pressure) }
    OnDestroy { appContext.reactContext?.unregisterComponentCallbacks(pressure); release() }
  }
}
