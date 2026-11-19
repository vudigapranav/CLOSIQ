package app.closiq.vision

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


class ClosiqVisionModule : Module() {
  private val lock = ReentrantLock()
  private val sessionLock = Any()
  private var active: Conversation? = null
  @Volatile private var engine: Engine? = null
  @Volatile private var discardAfterRun = false
  private val context get() = requireNotNull(appContext.reactContext)
  private val model get() = File(context.noBackupFilesDir, "307bf6d1018edd2c2d0903b92628151bdb5cc2b7.litertlm")

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

  override fun definition() = ModuleDefinition {
    Name("ClosiqVision")
    AsyncFunction("status") { if (engine != null) "ready" else if (model.isFile) "installed" else "missing" }
    AsyncFunction("memoryKiB") { Debug.getPss().toDouble() }
    AsyncFunction("install") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        exclusive {
          val input = localFile(uri)
          require(input.length() == 363085824L) { "Incorrect model size." }
          val stage = File(model.parentFile, "closiq-model.partial")
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
          } finally { stage.delete() }
        }
      }
    }
    AsyncFunction("initialize") Coroutine { ->
      withContext(Dispatchers.IO) {
        exclusive {
          if (engine == null) {
            check(model.isFile) { "Install the base model first." }
            val next = Engine(EngineConfig(modelPath = model.path, backend = Backend.CPU(),
              visionBackend = Backend.CPU(), maxNumTokens = 1024, maxNumImages = 1, cacheDir = context.cacheDir.path))
            try { next.initialize(); engine = next } catch (error: Throwable) { next.close(); throw error }
          }
        }
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
            try {
              val response = StringBuilder()
              runBlocking {
                chat.sendMessageAsync(contents).collect { part ->
                  response.append(part.toString())
                  if (response.length > 1600) chat.cancelProcess()
                }
              }
              response.toString()
            }
            finally { synchronized(sessionLock) { active = null } }
          }
        }
      }
    }
    AsyncFunction("cancel") { cancel() }
    AsyncFunction("unload") { release() }
    AsyncFunction("remove") {
      exclusive { engine?.close(); engine = null; check(!model.exists() || model.delete()) { "Could not delete model." } }
    }
    OnActivityEntersBackground { release() }
    OnDestroy { release() }
  }
}
